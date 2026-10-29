const express = require('express');
const app = express();

app.delete('/api/admin/users', (req, res) => {
  res.json({ deleted: true });
});

module.exports = app;

