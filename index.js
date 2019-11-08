const express = require('express')
const app = express()
const port = 3000

// API endpoints
app.get('/', (req, res) => {
    res.send('Hello World!')
})

// Run server
app.listen(port, () => console.log(`Example app listening on port ${port}`))
