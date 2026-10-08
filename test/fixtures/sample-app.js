const express = require('express');
const app = express();
const userRouter = express.Router();

// Global middleware
app.use(express.json());

// Public healthcheck route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Route with nested array of middlewares
app.post(
  '/checkout',
  [rateLimit, [verifyToken, validateCart]],
  checkoutHandler
);

// Protected delete route on sub-router
userRouter.delete('/:id', checkAdmin, deleteUserHandler);

// Mount the sub-router onto the app
app.use('/api/users', userRouter);

module.exports = app;
