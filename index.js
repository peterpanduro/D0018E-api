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
    // dbConnection.connect(function(err) {
    //     if (err) {
    //         console.log(err);
    //         throw err;
    //     }
    //     console.log('Database connected');
    // })
})

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
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('/api/products', (req, res) => {
    dbConnection.query(`SELECT * FROM Product`, function(error, results, fields) {
        if (error) {
            res.status(500)
            res.send(error);
        } else {
            res.status(200);
            res.send(JSON.stringify(results));
        }
    })
})
app.get('/api/product/:productId', (req, res) => {
    const pId = req.params.productId
    dbConnection.query(`SELECT * FROM Product where ID = ${pId}`, function(error, results, fields) {
        if (error) {
            res.status(500)
            res.send(error);
        } else {
            res.status(200);
            res.send(JSON.stringify(results));
        }
    })
})

app.post('/api/user/login', (req, res) => {
    const email = req.headers.email;
    const password = req.headers.password;
    // Check DB
    var token = jwt.sign({ email: email, password: password }, process.env.JWT_SECRET, { expiresIn: '30min' });
    res.status(200);
    res.send(JSON.stringify({jwt: token}));
})

app.get('/api/user', (req, res) => {
    verifyToken(req.headers.jwt, (status, response) => {
        // TODO: Get user from DB
        res.status(status);
        res.send(response);
    })
})