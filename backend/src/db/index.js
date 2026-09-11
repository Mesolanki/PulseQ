const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', '..', 'smart_clinic.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initDb() {
  console.log('📦 Initializing Database...');
  const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
  const seedPath = path.join(__dirname, '..', '..', '..', 'database', 'seed.sql');

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    // Translate PostgreSQL syntax to SQLite compatible syntax if needed
    const sqliteSchema = schemaSql
      .replace(/REAL/g, 'REAL')
      .replace(/BOOLEAN/g, 'INTEGER')
      .replace(/DEFAULT TRUE/g, 'DEFAULT 1')
      .replace(/DEFAULT FALSE/g, 'DEFAULT 0')
      .replace(/CURRENT_DATE/g, "(DATE('now'))");
    db.exec(sqliteSchema);
  }

  // Check if departments table has rows
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM departments').get();
  if (rowCount.count === 0 && fs.existsSync(seedPath)) {
    console.log('🌱 Seeding initial database data...');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    const sqliteSeed = seedSql
      .replace(/true/g, '1')
      .replace(/false/g, '0')
      .replace(/CURRENT_DATE/g, "(DATE('now'))");
    db.exec(sqliteSeed);
  }
}

// Convert PostgreSQL $1, $2 params or ? params
function formatSql(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

function query(sql, params = []) {
  const formatted = formatSql(sql);
  const stmt = db.prepare(formatted);
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    return stmt.all(params);
  } else {
    const info = stmt.run(params);
    return info;
  }
}

function get(sql, params = []) {
  const formatted = formatSql(sql);
  return db.prepare(formatted).get(params);
}

function all(sql, params = []) {
  const formatted = formatSql(sql);
  return db.prepare(formatted).all(params);
}

function run(sql, params = []) {
  const formatted = formatSql(sql);
  return db.prepare(formatted).run(params);
}

initDb();

module.exports = {
  db,
  query,
  get,
  all,
  run
};
