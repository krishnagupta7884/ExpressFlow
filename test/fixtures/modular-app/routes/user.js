const express = require('express');
const router = express.Router();

// User endpoints
router.get('/profile', verifyToken, getUserProfile);
router.put('/settings', verifyToken, validatePayload, updateSettings);

module.exports = router;
