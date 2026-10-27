const express = require('express');
const router = express.Router();

// VULNERABILITY 3: Missing Rate Limiting on Authentication Endpoint
router.post('/login', loginHandler);

// SECURE ROUTE: Authentication endpoint with rate-limiting throttling
router.post('/register', rateLimit, registerHandler);

module.exports = router;
