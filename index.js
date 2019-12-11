/* Imports and requires */
"use strict"
require('dotenv').config()
const express = require('express')
const jwt = require('jsonwebtoken')
const mysql = require('mysql')
const app = express()
/* Swagger stuff */
const swaggerUi = require('swagger-ui-express')
const fs = require('fs')
const jsyaml = require('js-yaml')
const spec = fs.readFileSync('swagger.yaml', 'utf8')
const swaggerDoc = jsyaml.safeLoad(spec)

/* Start server */
let port = process.env.EXPRESS_PORT
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    dbConnection.connect(function(err) {
        if (err) {
            console.log(err);
            throw err;
        }
        console.log('Database connected');
    })
})

/* Swagger */
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

/* DB */
const dbConnection = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

/* Helper functions */

/*
 * Verify Jsonwebtoken (JWT)
 * Uses callback with parameters (status, response)
 * If status != 200, an response is an error object.
 * If status == 200, response is decoded JWT.
 */
function verifyToken(token, callback) {
    if (!token) {
        callback(401, {errorCode: 401, error: "UNAUTHORIZED", description: "No JWT provided"});
    } else {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                callback(401, {errorCode: 401, error: "UNAUTHORIZED", description: "JWT invalid"});
            } else {
                callback(200, decoded);
            }
        });
    }
}

/* API endpoints */

/* User */

app.post('/user/login', (req, res) => {
    const query = `SELECT * FROM User WHERE Email = '${req.headers.email}' AND Hash = '${req.headers.password}'`;
    dbConnection.query(query, (error, results, fields) => {
        if (error) {
            res.status(401);
            res.send({errorCode: 401, error: "UNAUTHORIZED", description: "No user with that combination exist"});
        } else {
            if (results.length == 0) {
                res.status(401);
                res.send({errorCode: 401, error: "UNAUTHORIZED", description: "No user with that combination exist"});
            }
            if (results.length == 1) {
                var token = jwt.sign({ id: results[0].ID }, process.env.JWT_SECRET, { expiresIn: '30min' });
                res.status(200);
                res.send(JSON.stringify({jwt: token}));
            }
            if (results.length > 1) {
                res.status(500);
                res.send("THIS SHOULDNT BE HAPPENING");
            }
        }
    });
})

app.get('/user', (req, res) => {
    verifyToken(req.headers.jwt, (status, response) => {
        if (status != 200) {
            res.status(status);
            res.send(response);
        }
        dbConnection.query(`SELECT * FROM User WHERE ID = ${response.id}`, (error, results, fields) => {
            if (error) {
                res.status(500);
                res.send({errorCode: 500, error: "UNKNOWN SERVER ERROR", description: error});
            } else {
                if (results.length == 1) {
                    res.status(200);
                    res.send(results[0]);
                } else {
                    res.status(500);
                    res.send({errorCode: 500, error: "UNKNOWN SERVER ERROR", description: "For some reason GET /user didnt return a single user"});
                }
            }
        })
    })
})

/* Products */

app.get('/products', (req, res) => {
    var query = "";
    if (req.query.search != undefined) {
        query = ` WHERE (INSTR(Name, '${req.query.search}') > 0) OR (INSTR(Description, '${req.query.search}') > 0)`
    } else if (req.query.category != undefined) {
        query = ` WHERE Category = ${req.query.category}`
    }
    dbConnection.query(`SELECT * FROM Product${query}`, (error, results, fields) => {
        if (error) {
            res.status(500)
            res.send(error);
        } else {
            res.status(200);
            res.send(JSON.stringify(results));
        }
    })
})
app.get('/product/:productId', (req, res) => {
    const pId = req.params.productId;
    dbConnection.query(`SELECT * FROM Product where ID = ${pId}`, (error, results, fields) => {
        if (error) {
            res.status(500)
            res.send(error);
        } else {
            res.status(200);
            res.send(JSON.stringify(results));
        }
    })
})

/* Categories */
/* Cart */
/* Order */