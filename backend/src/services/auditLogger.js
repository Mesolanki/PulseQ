const { run, all } = require('../db');

function logAuditAction({ userId = 'system', action, targetType = null, targetId = null, reason = '', details = {} }) {
  const id = 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const detailsJson = typeof details === 'object' ? JSON.stringify(details) : details;
  
  run(
    `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, reason, details_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, datetime('now'))`,
    [id, userId, action, targetType, targetId, reason, detailsJson]
  );

  console.log(`🔒 [AUDIT LOG] ${action} by user:${userId} on ${targetType}:${targetId} | Reason: ${reason}`);
  return id;
}

function getAuditLogs(limit = 50) {
  return all(
    `SELECT a.*, u.full_name as user_name, u.role as user_role
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

module.exports = {
  logAuditAction,
  getAuditLogs
};
