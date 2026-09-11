const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getAuditLogs } = require('../services/auditLogger');

router.get('/', verifyToken, requireRole(['SUPER_ADMIN', 'HOSPITAL_ADMIN']), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  const logs = getAuditLogs(limit);
  res.json(logs);
});

module.exports = router;
