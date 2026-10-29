const express = require('express');
const app = express();

const verifyToken = (req, res, next) => next();

// Admin route with general authentication but NO role/privilege guard -> Rule 3
app.get('/api/admin/users', verifyToken, (req, res) => {
  res.json({ users: [] });
});

module.exports = app;
