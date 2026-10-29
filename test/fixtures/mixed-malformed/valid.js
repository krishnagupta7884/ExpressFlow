const express = require('express');
const app = express();

// Sensitive endpoint without authentication
app.delete('/api/admin/system', function deleteSystem(req, res) {
  res.send('system wiped');
});

module.exports = app;

