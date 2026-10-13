const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/config/database');

async function runMigrations() {
  const dbType = config.db.type || 'mysql';
  console.log(`Running database migrations for ${dbType}...`);

  const migrationFile = dbType === 'mysql'
    ? path.join(__dirname, '001_initial_schema_mysql.sql')
    : path.join(__dirname, '001_initial_schema.sql');

  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(migrationFile, 'utf8');

  try {
    if (dbType === 'mysql') {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        multipleStatements: true,
      });

      await connection.query(sqlContent);
      await connection.end();
    } else {
      await db.query(sqlContent);
    }

    console.log(`✓ Migrations executed successfully for ${dbType}!`);
    if (require.main === module) {
      process.exit(0);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
