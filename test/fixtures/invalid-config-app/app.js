const express = require('express');
const app = express();

// A sensitive administrative route without authentication
app.delete('/api/admin/system', (req, res) => {
  res.json({ status: 'destroyed' });
});

module.exports = app;

