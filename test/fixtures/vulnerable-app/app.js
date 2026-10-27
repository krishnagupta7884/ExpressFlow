const express = require('express');
const app = express();

// Global middleware
app.use(express.json());

// Load modular routers across file boundaries
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');
const userRouter = require('./routes/users');

// Mount sub-routers
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);

// Public health endpoint (Exempt from security checks)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

module.exports = app;
