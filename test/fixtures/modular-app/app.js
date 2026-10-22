const express = require('express');
const app = express();

// Global application middleware
app.use(express.json());

// Import sub-routers across files
const adminRouter = require('./routes/admin');
const userRouter = require('./routes/user');

// Mount sub-routers with path prefixes
app.use('/api/admin', adminRouter);
app.use('/api/users', userRouter);

// Health check endpoint
app.get('/status', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
