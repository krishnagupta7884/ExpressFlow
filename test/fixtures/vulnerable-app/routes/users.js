const express = require('express');
const router = express.Router();

// SECURE ROUTE: Protected user profile retrieval
router.get('/profile', verifyToken, getProfileHandler);

// SECURE ROUTE: Protected user settings update
router.put('/settings', verifyToken, updateSettingsHandler);

module.exports = router;

