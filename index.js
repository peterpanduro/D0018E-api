const express = require('express')
const mysql = require('mysql')
const app = express()
const port = 3001
const swaggerUi = require('swagger-ui-express')
const fs = require('fs')
const jsyaml = require('js-yaml')
const spec = fs.readFileSync('swagger.yaml', 'utf8')
const swaggerDoc = jsyaml.safeLoad(spec)
const jwt = require('jsonwebtoken')
require('dotenv').config()

const dbConnection = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: 'api',
    password: 'root',
    database: 'datamerch'
})

// API endpoints
app.get('/', (req, res) => {
    res.send('Hello World!');
})
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
app.get('/api/category', (req, res) => {
    dbConnection.query(`SELECT * FROM Category`, function(error, results, fields) {
        if (error) {
            res.send(error);
        } else {
            res.send(JSON.stringify(results));
        }
    })
})
app.get('/api/category/:categoryId', (req, res) => {
    const cId = req.params.categoryId;
    dbConnection.query(`SELECT * FROM Category WHERE ID = ${cId}`, function(error, results, fields) {
        if (error) {
            res.send(error);
        } else {
            res.send(JSON.stringify(results));
        }
    })
})

app.post('/api/user/login', (req, res) => {
    const email = req.headers.email;
    const password = req.headers.password
    // Check DB
    var token = jwt.sign({ email: email, password: password }, process.env.JWT_SECRET, { expiresIn: '30min' });
    res.status(200);
    res.send(JSON.stringify({jwt: token}));
})

app.get('/api/user', (req, res) => {
    const token = req.headers.jwt;
    if (!token) {
        res.status(401)
        res.send({errorCode: 401, error: "UNAUTHORIZED", description: "No JWT provided"});
    } else {
        jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
            if (err) {
                res.status(401);
                res.send({errorCode: 401, error: "UNAUTHORIZED", description: "JWT invalid"});
            } else {
                res.status(200);
                res.send(decoded);
            }
        });
    }
})

// Run server
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
