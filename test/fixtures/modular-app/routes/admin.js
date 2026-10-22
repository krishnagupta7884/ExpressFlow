const express = require('express');
const router = express.Router();

// Sensitive admin endpoints with multi-stage guards
router.delete('/database', verifyAdmin, purgeDatabase);
router.post('/restart', verifyAdmin, auditLog, restartServer);

module.exports = router;
