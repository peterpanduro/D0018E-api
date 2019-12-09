const express = require('express')
const mysql = require('mysql')
const app = express()
const port = 3001
const swaggerUi = require('swagger-ui-express')
const fs = require('fs')
const jsyaml = require('js-yaml')
const spec = fs.readFileSync('swagger.yaml', 'utf8')
const swaggerDoc = jsyaml.safeLoad(spec)

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
            res.send(error);
        } else {
            res.send(JSON.stringify(results));
        }
    })
})
app.get('/api/product/:productId', (req, res) => {
    const pId = req.params.productId
    dbConnection.query(`SELECT * FROM Product where ID = ${pId}`, function(error, results, fields) {
        if (error) {
            res.send(error);
        } else {
            res.send(JSON.stringify(results));
        }
    })
})
app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Run server
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
