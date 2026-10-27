const express = require('express');
const router = express.Router();

// VULNERABILITY 1: Unauthenticated Sensitive Route (Missing Auth Guard completely!)
router.delete('/purge-cache', purgeCacheHandler);

// VULNERABILITY 2: Misordered Security Middleware (Handler runs BEFORE verifyAdmin!)
router.post('/drop-database', dropDatabaseHandler, verifyAdmin);

// SECURE ROUTE: Properly protected with admin guard preceding the action
router.post('/maintenance', verifyAdmin, maintenanceHandler);

module.exports = router;
