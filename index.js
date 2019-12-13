/* Imports and requires */
"use strict";
require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require("mysql");
const app = express();
const cors = require("cors");
const url = require('url')
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
      console.log(err);
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

/* API endpoints */

/* User */

app.post("/user/login", (req, res) => {
  const query = `SELECT * FROM User WHERE Email = '${req.headers.email}'`;
  dbConnection.query(query, (dbError, dbResult, fields) => {
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
    if (status != 200) {
      res.status(status);
      res.send(response);
    }
    getUser(response.id, (status, response) => {
      res.status(status);
      res.send(response);
    });
  });
});

app.post("/user", (req, res) => {
  if (!req.body.name) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "No name provided"
    });
    return;
  }
  if (!req.body.email) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "No email provided"
    });
    return;
  }
  if (!req.body.password) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "No password provided"
    });
    return;
  }
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
          dbConnection.query(
            `INSERT INTO User (Name, Email, Password) VALUES ('${req.body.name}', '${req.body.email}', '${hashed}')`,
            (dbError2, dbResults2, fields2) => {
              if (dbError2) {
                res.status(500);
                res.send({
                  errorCode: 500,
                  error: "UNKNOWN SERVER ERROR",
                  description: dbError2
                });
              } else {
                res.status(201);
                res.send({ INFO: "User is created" });
              }
            }
          );
        }
      }
    }
  );
});

/* Products */

app.get("/products", (req, res) => {
  var url_params = url.parse(req.url, true);
  var q = url_params.query;
  var query = "";
  if (req.query.search != undefined) {
    query = ` WHERE (INSTR(Name, '${req.query.search}') > 0) OR (INSTR(Description, '${req.query.search}') > 0)`;
  } else if (req.query.category != undefined) {
    query = ` WHERE Category = ${req.query.category}`;
  }
  const dbQuery = `SELECT * FROM vProductInfo${query}`;
  dbConnection.query(
    dbQuery,
    (error, results, fields) => {
      if (error) {
        res.status(500);
        res.send(error);
      } else {
        res.status(200);
        res.json(results);
      }
    }
  );
});

app.get("/product/:productId", (req, res) => {
  const pId = req.params.productId;
  dbConnection.query(
    `SELECT * FROM vProductInfo where ID = ${pId}`,
    (error, results, fields) => {
      if (error) {
        res.status(500);
        res.send(error);
      } else {
        res.status(200);
        res.json(results);
      }
    }
  );
});

app.post("/product", (req, res) => {
  if (!req.body.name) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "Name not provided"
    });
    return;
  }
  if (!req.body.price) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "Price not provided"
    });
    return;
  }
  if (!req.body.stock) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "Stock not provided"
    });
    return;
  }
  if (!req.body.category) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "Category not provided"
    });
    return;
  }
  if (!req.body.description) {
    res.status(400);
    res.send({
      errorCode: 400,
      error: "BAD REQUEST",
      description: "Description not provided"
    });
    return;
  }
  verifyToken(req.headers.jwt, (status, response) => {
    if (status != 200) {
      res.status(status);
      res.send(response);
    } else {
      const user = getUser(response.id, (status, user) => {
        if (user.Privilege >= 1) {
          dbConnection.query(
            `INSERT INTO Product (Name, Price, Stock, Category, Description) VALUES ('${req.body.name}','${req.body.price}','${req.body.stock}','${req.body.category}','${req.body.description}')`,
            (dbError, dbResult, fields) => {
              if (dbError) {
                res.status(500);
                res.send({
                  errorCode: 500,
                  error: "UNKNOWN SERVER ERROR",
                  description: dbError
                });
              } else {
                res.status(201);
                res.send("Product created");
              }
            }
          );
        } else {
          res.status(403);
          res.send({
            errorCode: 403,
            error: "FORBIDDEN",
            description: "User not allwed to do that"
          });
        }
      });
    }
  });
});

/* Categories */

app.get('/categories', (req, res) => {
  dbConnection.query(`SELECT * FROM Category`, (dbError, dbResult, fields) => {
    res.status(200);
    res.json(dbResult);
  })
})

/* Cart */
/* Order */
