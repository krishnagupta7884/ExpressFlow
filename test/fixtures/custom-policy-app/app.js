const express = require('express');
const app = express();

// Custom public routes that would otherwise be flagged if not configured
app.post('/api/custom-signup', function signupHandler(req, res) {
  res.json({ message: "registered" });
});

// Custom public auth entrypoint without rate limiting
app.post('/api/custom-login', function loginHandler(req, res) {
  res.json({ token: "xyz" });
});

// Custom protected route
app.delete('/api/custom-protected', function deleteHandler(req, res) {
  res.json({ deleted: true });
});

module.exports = app;

