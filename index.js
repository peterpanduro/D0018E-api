const express = require('express')
const mysql = require('mysql')
const app = express()
const port = 3000

const dbConnection = mysql.createConnection({
    host: '37.123.183.130',
    port: '3306',
    user: 'stefan',
    password: 'backend',
    database: 'd0018e_test'
})

// API endpoints
app.get('/', (req, res) => {
    res.send('Hello World! Does it work now?');
})

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
