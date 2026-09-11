const express = require('express');
const router = express.Router();
const { all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');

router.get('/', (req, res) => {
  const settings = all(`SELECT * FROM clinic_settings`);
  res.json(settings);
});

router.put('/', verifyToken, (req, res) => {
  const { settings } = req.body;
  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({ error: 'Settings array required' });
  }

  settings.forEach(s => {
    run(
      `INSERT INTO clinic_settings (key_name, value_text, description, updated_at)
       VALUES ($1, $2, $3, datetime('now'))
       ON CONFLICT(key_name) DO UPDATE SET value_text = $2, updated_at = datetime('now')`,
      [s.key_name, s.value_text, s.description || '']
    );
  });

  logAuditAction({
    userId: req.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'system',
    targetId: 'clinic_settings',
    reason: `Updated ${settings.length} system configuration settings`
  });

  res.json({ success: true });
});

module.exports = router;
