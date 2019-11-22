const express = require('express')
const mysql = require('mysql')
const app = express()
const port = 3000
const swaggerUi = require('swagger-ui-express')
const fs = require('fs')
const jsyaml = require('js-yaml')
const spec = fs.readFileSync('swagger.yaml', 'utf8')
const swaggerDoc = jsyaml.safeLoad(spec)

const dbConnection = mysql.createConnection({
    host: '37.123.183.130',
    port: '3306',
    user: 'stefan',
    password: 'backend',
    database: 'd0018e_test'
})

// API endpoints
app.get('/', (req, res) => {
    res.send('Hello World!');
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
