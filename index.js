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
    user: 'root',
    password: 'secretpassword',
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
//app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.post('/api/user/login', (req, res) => {
    const email = req.headers.email;
    const password = req.headers.password
    // Check DB
    var token = jwt.sign({ email: email, password: password }, process.env.JWT_SECRET, { expiresIn: '30min' });
    res.status(200);
    res.send(JSON.stringify({jwt: token}));
})

app.get('/api/user', (req, res) => {
    verifyToken(req, (status, response) => {
        res.status(status);
        res.send(response);
    })
})

/*
 * Verify Jsonwebtoken (JWT)
 * Uses callback with parameters (status, response)
 * If status != 200, an response is an error object.
 * If status == 200, response is decoded JWT.
 */
function verifyToken(req, callback) {
    const token = req.headers.jwt;
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
