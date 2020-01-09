/* Imports and requires */
"use strict";
require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require("mysql");
const app = express();
const cors = require("cors");
const bodyParser = require('body-parser')
/* Swagger stuff */
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const jsyaml = require("js-yaml");
const spec = fs.readFileSync("swagger.yaml", "utf8");
const swaggerDoc = jsyaml.safeLoad(spec);

/* DB */
const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/* Start server */
let port = process.env.EXPRESS_PORT;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  dbConnection.connect(err => {
    if (err) {
      console.error(err);
      throw err;
    }
    console.log("Database connected");
  });
});

/* Middleware and stuff */
app.use(cors());
app.use(bodyParser.json())
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

/* Helper functions */

/*
 * Verify Jsonwebtoken (JWT)
 * Uses callback with parameters (status, response)
 * If status != 200, an response is an error object.
 * If status == 200, response is decoded JWT.
 */
function verifyToken(token, callback) {
  if (!token) {
    callback(401, {
      errorCode: 401,
      error: "UNAUTHORIZED",
      description: "No JWT provided"
    });
  } else {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        callback(401, {
          errorCode: 401,
          error: "UNAUTHORIZED",
          description: "JWT invalid"
        });
      } else {
        callback(200, decoded);
      }
    });
  }
}

function promiseVerifyToken(token) {
  return new Promise(async (resolve, reject) => {
    if (!token) {
      reject({
        errorCode: 401,
        error: "UNAUTHORIZED",
        description: "No JWT provided"
      });
    }
    try {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      resolve(decoded);
    } catch(err) {
      reject({
        errorCode: 401,
        error: "UNAUTHORIZED",
        description: "JWT invalid"
      });
    }
  })
}

function getUser(id, callback) {
  dbConnection.query(
    `SELECT * FROM User WHERE ID = ${id}`,
    (error, results, fields) => {
      if (error) {
        callback(500, {
          errorCode: 500,
          error: "UNKNOWN SERVER ERROR",
          description: error
        });
      } else {
        if (results.length == 1) {
          callback(200, results[0]);
        } else {
          callback(400, {
            errorCode: 400,
            error: "BAD REQUEST",
            description: "User not found"
          });
        }
      }
    }
  );
}

async function promiseGetUser(id) {
  return new Promise(async (resolve, reject) => {
    const dbQuery = `SELECT * FROM User WHERE ID = ${id};`;
    try {
      const response = await promiseQuery(dbQuery);
      if (response.length == 1) {
        resolve(response[0]);
      } else {
        reject({
          errorCode: 400,
          error: "BAD REQUEST",
          description: "User not found"
        });
      }
    } catch (error) {
      reject({
        errorCode: 500,
        error: "UNKNOWN SERVER ERROR",
        description: error
      });
    }
  });
}

function verifyParam(res, param, errorMsg) {
  if (param === undefined) {
      res.status(400);
      res.send({
        errorCode: 400,
        error: "BAD REQUEST",
        description: errorMsg
      });
      return false;
    }
    return true;
}

function verifyIsInt(res, param, errorMsg) {
  if (!Number.isInteger(parseInt(param))) {param = undefined};
  return verifyParam(res, param, errorMsg);
}

function query(query, res, successStatus = 200, completion = undefined) {
  dbConnection.query(query, (error, result, fields) => {
    const status = error ? 500 : successStatus;
    const send = error ? error : result;
    if (res) {
      res.status(status);
      res.json(send);
    }
    if (completion) {
      completion(status, send);
    }
    return;
  });
}

function promiseQuery(query) {
  return new Promise((resolve, reject) => {
    dbConnection.query(query, (error, result, fields) => {
      if (error) {
        reject(error);
      }
      const response = error ? error : result;
      resolve(response);
    });
  });
}

function checkStatus(status, response, res) {
  if (status !== 200) {
    res.status(status);
    res.send(response);
    return false;
  }
  return true;
}

function getStatusString(statusId) {
  switch (statusId) {
    case 1:
      return "Pending";
    case 2:
      return "Confirmed";
    case 3:
      return "Shipping";
    case 4:
      return "Complete";
    case 5:
      return "Other";
    case 6:
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function send(res, result, status = 200) {
  res.status(status);
  res.json(result);
}

/* API endpoints */

/* User */

app.post("/user/login", (req, res) => {
  const dbQuery = `SELECT * FROM User WHERE Email = '${req.headers.email}'`;
  dbConnection.query(dbQuery, (dbError, dbResult, fields) => {
    if (dbError) {
      res.status(500);
      res.send({
        errorCode: 500,
        error: "UNKNOWN SERVER ERROR",
        description: dbError
      });
    } else {
      if (dbResult.length == 0) {
        res.status(401);
        res.send({
          errorCode: 401,
          error: "UNAUTHORIZED",
          description: "No user with that combination exist"
        });
      }
      if (dbResult.length == 1) {
        if (bcrypt.compareSync(req.headers.password, dbResult[0].Password)) {
          const token = jwt.sign(
            { id: dbResult[0].ID },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
          );
          res.status(200);
          res.json({jwt: token});
        } else {
          res.status(401);
          res.send({
            errorCode: 401,
            error: "UNAUTHORIZED",
            description: "No user with that combination exist"
          });
        }
      }
    }
  });
});

app.get("/user", (req, res) => {
  verifyToken(req.headers.jwt, (status, response) => {
    if (!checkStatus(status, response, res)) return;
    getUser(response.id, (status, response) => {
      res.status(status);
      res.send(response);
    });
  });
});

app.post("/user", (req, res) => {
  if (!verifyParam(res, req.body.name, "No name provided")) return;
  if (!verifyParam(res, req.body.email, "No email provided")) return;
  if (!verifyParam(res, req.body.password, "No password provided")) return;
  if (!verifyParam(res, req.body.emailToken, "No email token provided")) return;

  dbConnection.query(
    `SELECT * FROM User WHERE Email = '${req.body.email}'`,
    (dbError, dbResults, fields) => {
      if (dbError) {
        res.status(500);
        res.send({
          errorCode: 500,
          error: "UNKNOWN SERVER ERROR",
          description: dbError
        });
      } else {
        if (dbResults.length != 0) {
          res.status(300);
          res.send({
            errorCode: 300,
            error: "ERROR",
            description: "Email already exist"
          });
        } else {
          const hashed = bcrypt.hashSync(req.body.password, 10);
          const dbQuery = `INSERT INTO User (Name, Email, Password, Token) VALUES ('${req.body.name}', '${req.body.email}', '${hashed}', '${req.body.emailToken}')`;
          query(dbQuery, res);
        }
      }
    }
  );
});

app.patch("/user", (req, res) => {
  verifyToken(req.headers.jwt, (status, response) => {
    if (!checkStatus(status, response, res)) return;
    var iterationStatement = "";
    for (let key in req.body) {
      iterationStatement += `${key} = '${req.body[key]}', `
    }
    if (iterationStatement.length > 1) {iterationStatement = iterationStatement.slice(0, -2);}
    const dbQuery = `UPDATE User SET ${iterationStatement} WHERE ID = '${response.id}';`;
    query(dbQuery, res);
  });
});

/* Products */

app.get("/products", (req, res) => {
  var q = "";
  if (req.query.search != undefined) {
    q = ` WHERE (INSTR(Name, '${req.query.search}') > 0) OR (INSTR(Description, '${req.query.search}') > 0)`;
  } else if (req.query.category != undefined) {
    q = ` WHERE Category = ${req.query.category}`;
  }
  if (q === "") {
    q += " WHERE Archived = 0";
  } else {
    q += " AND Archived = 0";
  }
  const dbQuery = `SELECT * FROM vProductInfo${q};`;
  query(dbQuery, res);  
});

app.get("/product/:productId", (req, res) => {
  const pId = req.params.productId;
  const dbQuery = `SELECT * FROM vProductInfo where ID = ${pId}`;
  query(dbQuery, res);
  return;
});

app.post("/product", async (req, res) => {
  if (!verifyParam(res, req.body.name, "No name provided")) return;
  if (!verifyIsInt(res, req.body.price, "No price INT provided")) return;
  if (!verifyIsInt(res, req.body.discountPrice, "No discountPrice INT provided")) return;
  if (!verifyIsInt(res, req.body.stock, "No stock INT provided")) return;
  if (!verifyIsInt(res, req.body.category, "No category INT provided")) return;
  if (!verifyParam(res, req.body.description, "No description provided")) return;
  if (!verifyParam(res, req.body.image, "No image url provided")) return;
  if (!verifyParam(res, req.body.imageDescription, "No image description provided")) return;
  if (!verifyIsInt(res, req.body.archived, "No archieved INT provided")) return;
  try {
    const token = await promiseVerifyToken(req.headers.jwt);
    const user = promiseGetUser(token.id);
    if (user.Privilege === 0) { 
      res.status(403);
      res.send({
        errorCode: 403,
        error: "FORBIDDEN",
        description: "User not allwed to do that"
      });
      return;
     }
     dbConnection.beginTransaction(async (err) => {
      if (err) { throw err; }
      try {
        const productQuery = `INSERT INTO Product (Name, Price, DiscountPrice, Stock, Category, Description, Archived) VALUES ('${req.body.name}','${req.body.price}','${req.body.discountPrice}','${req.body.stock}','${req.body.category}','${req.body.description}','${req.body.archived}');`;
        const productResult = await promiseQuery(productQuery);
        const lastIdQuery = `SELECT LAST_INSERT_ID();`;
        const lastIdResult = await promiseQuery(lastIdQuery);
        const productIdPacket = lastIdResult[0];
        const productId = productIdPacket['LAST_INSERT_ID()'];
        const imageQuery = `INSERT INTO Image (url, caption, product) VALUES ('${req.body.image}', '${req.body.imageDescription}', '${productId}');`;
        const imageResult = await promiseQuery(imageQuery);
        dbConnection.commit((err) => {
          if (err) {
            return connection.rollback(() => {
              throw err;
            });
          }
          send(res, {productResult, imageResult});
        })
      } catch (e) {
        return dbConnection.rollback(() => {
          throw e;
        });
      }
     })
  } catch (error) {
    console.error(error);
    send(res, error, error.errorCode || 500);
  }
});

app.put('/product/:productId', async (req, res) => {
  if (!verifyParam(res, req.body.name, "No name provided")) return;
  if (!verifyIsInt(res, req.body.price, "No name price")) return;
  if (!verifyIsInt(res, req.body.discountPrice, "No discountPrice provided")) return;
  if (!verifyIsInt(res, req.body.stock, "No stock provided")) return;
  if (!verifyIsInt(res, req.body.category, "No category provided")) return;
  if (!verifyParam(res, req.body.description, "No description provided")) return;
  if (!verifyParam(res, req.body.image, "No image url provided")) return;
  if (!verifyParam(res, req.body.imageDescription, "No image description provided")) return;
  if (!verifyIsInt(res, req.body.archived, "No archieved provided")) return;

  try {
    const token = await promiseVerifyToken(req.headers.jwt);
    const user = promiseGetUser(token.id);
    if (user.Privilege === 0) { 
      res.status(403);
      res.send({
        errorCode: 403,
        error: "FORBIDDEN",
        description: "User not allwed to do that"
      });
      return;
     }
     dbConnection.beginTransaction(async (erro) => {
      if (erro) { throw erro; }
      try {
        const pId = req.params.productId;
        const productQuery = `UPDATE Product SET Name = '${req.body.name}', Price = '${req.body.price}', DiscountPrice = '${req.body.discountPrice}', Stock = '${req.body.stock}', \`Category\` = '${req.body.category}', Description = '${req.body.description}', Archived = '${req.body.archived}' WHERE ID = '${pId}';`;
        const productResult = await promiseQuery(productQuery);
        const getImageQuery = `SELECT * FROM Image WHERE product = '${pId}';`;
        const getImageResult = await promiseQuery(getImageQuery);
        const image = getImageResult[0];
        const imageQuery = `UPDATE Image SET url = '${req.body.image}', caption = '${req.body.imageDescription}', product = '${pId}' WHERE ID = '${image.ID}';`;
        const imageResult = await promiseQuery(imageQuery);
        dbConnection.commit((er) => {
          if (er) {
            return connection.rollback(() => {
              throw er;
            });
          }
          send(res, {productResult, imageResult});
        })
      } catch (e) {
        return dbConnection.rollback(() => {
          throw e;
        });
      }
     })
  } catch (error) {
    console.error(error);
    send(res, error, error.errorCode || 500);
  }
})

/* Comments */
app.get("/comments/:productId", (req, res) => {
  const pId = req.params.productId;
  const dbQuery = `SELECT * FROM vCommentInfo where ProductID = ${pId}`;
  query(dbQuery, res);
});

app.post('/comments/:productId', (req, res) => {
  if (!verifyParam(res, req.body.opinion, "No opinion provided")) return;
  if (!verifyParam(res, req.body.rating, "No rating provided")) return;
  if (!Number.isInteger(req.body.rating)) {
      res.status(400);
      res.send({
        errorCode: 400,
        error: "BAD REQUEST",
        description: "Rating is not an integer"
      });
  }
  if (req.body.rating < 0 || req.body.rating > 5) {
    res.status(400);
      res.send({
        errorCode: 400,
        error: "BAD REQUEST",
        description: "Rating must be between 0 and 5"
      });
  }

  verifyToken(req.headers.jwt, (status, response) => {
    if (!checkStatus(status, response, res)) return;
    const pId = req.params.productId;
    if (Number.isInteger(parseInt(pId))) {
      const dbQuery = `INSERT INTO Review (UserID, ProductID, Opinion, Rating) VALUES ('${response.id}', '${pId}', '${req.body.opinion}', '${req.body.rating}');`;
      query(dbQuery, res);
      return;
    } else {
      res.status(400);
      res.send("ERROR WTF IS WRONG WITH U?");
      return;
    }
  })
})

app.delete('/comments/:commentId', (req, res) => {
  verifyToken(req.headers.jwt, (status, response) => {
    if (!checkStatus(status, response, res)) return;
    getUser(response.id, (status, user) => {
      if (user.Privilege >= 1) {
        const cId = req.params.commentId;
        const dbQuery = `DELETE FROM Review WHERE ID = '${cId}'`;
        query(dbQuery, res);
        return;
      } else {
        res.status(403);
        res.send({
          errorCode: 403,
          error: "FORBIDDEN",
          description: "User not allwed to do that"
        });
      }
    })
  })
})

/* Categories */
app.get('/categories', (req, res) => {
  const dbQuery = `SELECT * FROM Category`;
  query(dbQuery, res);
});

app.post('/category', (req, res) => {
  if (!verifyParam(res, req.body.name, "No name provided")) return;
  if (!verifyParam(res, req.body.description, "No description provided")) return;

  verifyToken(req.headers.jwt, (status, response) => {
    if (!checkStatus(status, response, res)) return;
    getUser(response.id, (status, user) => {
      if (user.Privilege >= 1) {
        const dbQuery = `INSERT INTO Category (Name, Description) VALUES ('${req.body.name}', '${req.body.description}');`;
        query(dbQuery, res);
      } else {
        res.status(403);
        res.send({
          errorCode: 403,
          error: "FORBIDDEN",
          description: "User not allwed to do that"
        });
      }
    })
  })
})

app.put('/category', (req, res) => {
  if (!verifyParam(res, req.body.id, "No id provided")) return;
  if (!verifyParam(res, req.body.name, "No name provided")) return;
  if (!verifyParam(res, req.body.description, "No description provided")) return;

  verifyToken(req.headers.jwt, (status, response) => {
    if (!checkStatus(status, response, res)) return;
    getUser(response.id, (status, user) => {
      if (user.Privilege >= 1) {
        const dbQuery = `UPDATE Category SET Name = '${req.body.name}', Description = '${req.body.description}' WHERE ID = '${req.body.id}';`;
        query(dbQuery, res);
      } else {
        res.status(403);
        res.send({
          errorCode: 403,
          error: "FORBIDDEN",
          description: "User not allwed to do that"
        });
        return;
      }
    })
  })
})

/* Order */

async function getOrderItems(orderId) {
  return new Promise(async (resolve, reject) => {
    try {
      const dbQuery = `SELECT * FROM OrderDetails WHERE \`Order\` = '${orderId}';`;
      const orderItems = await promiseQuery(dbQuery);
      const returnItems = orderItems.map(item => {
        return {product: item.ProductID, quantity: item.Quantity, unitPrice: item.UnitPrice}
      });
      resolve(returnItems);
    } catch (error) {
      reject(error);
    }
  })
}

app.get('/orders', async (req, res) => {
  try {
    const token = await promiseVerifyToken(req.headers.jwt);
    const user = await promiseGetUser(token.id);
    const dbQuery = `SELECT * FROM Orders WHERE UserID = '${user.ID}';`;
    const orders = await promiseQuery(dbQuery);
    const returnOrders = await Promise.all(orders.map(async order => {
      const items = await getOrderItems(order.ID);
      const status = getStatusString(order.Status);
      return {order: {orderId: order.ID, status, orderDate: order.Date, shipped: order.ShippedDate, address: order.Address, items}};
    }));
    send(res, returnOrders);    
  } catch (error) {
    send(res, error, error.errorCode);
  }
});

async function createAddress(name, address, zipCode) {
  return new Promise(async (resolve, reject) => {
    const dbQuery = `INSERT INTO Address (Name, ZipCode, Address) VALUES ('${name}', '${zipCode}', '${address}');`;
    const response = await promiseQuery(dbQuery);
    resolve(response);
  });
}

async function getAddressId(name, address, zipCode) {
  return new Promise(async (resolve, reject) => {
    const dbQuery = `SELECT ID FROM Address WHERE Name = '${name}' AND Address = '${address}' AND ZipCode = '${zipCode}';`;
    const response = await promiseQuery(dbQuery);
    const retVaulue = response[0] ? response[0].ID : undefined;
    resolve(retVaulue);
  });  
}

async function getAddressIdOrCreate(name, address, zipCode) {
  return new Promise(async (resolve, reject) => {
    const addressId = await getAddressId(name, address, zipCode);
    if (addressId) {
      resolve(addressId);
      return;
    }
    await createAddress(name, address, zipCode);
    const addressId2 = await getAddressId(name, address, zipCode);
    resolve(addressId2);
  });
}

app.post('/orders', async (req, res) => {
  if (!verifyParam(res, req.body.address, "No address provided")) return;
  if (!verifyParam(res, req.body.zipCode, "No zipCode provided")) return;
  if (!verifyParam(res, req.body.items, "No items provided")) return;
  dbConnection.beginTransaction(async err => {
    if (err) { throw err; }
    try {
      const token = await promiseVerifyToken(req.headers.jwt);
      const user = await promiseGetUser(token.id);
      try {
          const addressId = await getAddressIdOrCreate(user.Name, req.body.address, req.body.zipCode);
          // Create new order
          const orderQuery = `INSERT INTO Orders (UserID, Status, Address) VALUES ('${user.ID}', 1, '${addressId}');`;
          await promiseQuery(orderQuery);
          const lastIdQuery = `SELECT LAST_INSERT_ID();`;
          const lastIdResult = await promiseQuery(lastIdQuery);
          const orderId = lastIdResult[0]['LAST_INSERT_ID()'];
          // Create order details
          await req.body.items.forEach(async item => {
            try {
              if (!item.product) {throw new Error("No product is specified for item");}
              if (!item.quantity) {throw new Error("No quantity is specified for item");}
              const productQuery = `SELECT * FROM vProductInfo where ID = ${item.product};`;
              const productResult = await promiseQuery(productQuery);
              const product = productResult[0];
              var price = product.Price;
              if (product.DiscountPrice < price && product.DiscountPrice > 0) {price = product.DiscountPrice};
              const orderDetailQuery = `INSERT INTO OrderDetails (ProductID, Quantity, UnitPrice, \`Order\`) VALUES ('${item.product}', '${item.quantity}', '${price}', '${orderId}');`;
              await promiseQuery(orderDetailQuery);
              dbConnection.commit(error => {
                if (error) {
                  throw error;
                }
              })
            } catch (error) {
              throw error;
            }
        });
        // Commit
        send(res, "SUCCESS");
      } catch (error) {
        throw error;
      }
    } catch (error) {
      dbConnection.rollback(() => {
        send(res, error, error.errorCode);
      });
    }
  })

  // function isAdmin(jwt) {
  //   const promise = new Promise(async(resolve, reject) => {
  //     try {
  //       const token = await promiseVerifyToken(jwt);
  //       const user = await promiseGetUser(token.id);
  //       const admin = user.Privilege > 0 ? true : false;
  //       resolve(admin);
  //     } catch (error) {
  //       throw error;
  //     }
  //   })
  //   return Promise.all([promise]);
  // }

  app.get("/test", (req, res) => {
    send(res, "OK");
  })

  app.patch("/orders/:orderId", async (req, res) => {
    if (!verifyParam(res, req.body.orderStatus, "No orderStatus provided")) return;
    if (!isAdmin(req.headers.jwt)) {
      res.status(403);
      res.send({
        errorCode: 403,
        error: "UNAUTHORIZED",
        description: "User not admin"
      });
      return;
    }
    const cId = req.params.orderId;
    const dbQuery = `UPDATE Orders SET OrderStatus = '${req.body.orderStatus}' WHERE ID = '${cId}'`;
    try {
      const result = await promiseQuery(dbQuery);
      send(res, result);
    } catch (error) {
      send(res, error, error.errorCode || 500);
    }
  })
});
