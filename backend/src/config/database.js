const fs = require('fs');
const path = require('path');
const config = require('./index');

let pool = null;
let memoryDbAdapter = null;
let isUsingMemory = false;
let currentDbType = config.db.type || 'mysql';

function convertDollarParamsToQuestionMarks(sql, params = []) {
  const newParams = [];
  const newSql = sql.replace(/\$(\d+)/g, (match, num) => {
    const index = parseInt(num, 10) - 1;
    newParams.push(params[index]);
    return '?';
  });
  return { sql: newSql, params: newParams };
}

function initDatabase() {
  if (config.db.useMemoryDb) {
    return setupMemoryDb();
  }

  if (config.db.type === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
        enableKeepAlive: true,
      });
      currentDbType = 'mysql';
      isUsingMemory = false;
      return pool;
    } catch (err) {
      console.warn('MySQL pool connection failed, falling back to memory database:', err.message);
      return setupMemoryDb();
    }
  }

  // PostgreSQL default
  try {
    const { Pool } = require('pg');
    const poolConfig = config.db.connectionString
      ? { connectionString: config.db.connectionString, ssl: config.db.ssl }
      : {
          host: config.db.host,
          port: config.db.port,
          database: config.db.database,
          user: config.db.user,
          password: config.db.password,
          ssl: config.db.ssl,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        };

    pool = new Pool(poolConfig);
    currentDbType = 'postgres';
    isUsingMemory = false;
    return pool;
  } catch (err) {
    console.warn('PostgreSQL pool connection failed, falling back to memory database:', err.message);
    return setupMemoryDb();
  }
}

function setupMemoryDb() {
  if (memoryDbAdapter) return memoryDbAdapter;

  const { newDb } = require('pg-mem');
  const mem = newDb();

  const schemaSqlPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
  if (fs.existsSync(schemaSqlPath)) {
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    mem.public.none(schemaSql);
  }

  const pgAdapter = mem.adapters.createPg();
  memoryDbAdapter = new pgAdapter.Pool();
  isUsingMemory = true;
  currentDbType = 'memory';
  return memoryDbAdapter;
}

/**
 * Executes query on MySQL pool with transparent RETURNING clause and $1 translation
 */
async function executeMysqlQuery(activePool, text, params = []) {
  const returningMatch = text.match(/\s+RETURNING\s+([\s\S]+)$/i);
  let cleanSql = text;
  let returningFields = null;

  if (returningMatch) {
    returningFields = returningMatch[1].trim().replace(/;$/, '');
    cleanSql = text.replace(/\s+RETURNING\s+[\s\S]+$/i, '').trim();
  }

  // Convert $1, $2 to ? and reorder parameters
  const converted = convertDollarParamsToQuestionMarks(cleanSql, params);
  let sqlToRun = converted.sql;
  const paramsToRun = converted.params;

  // Normalize COUNT(*) without AS
  if (/SELECT\s+COUNT\(\*\)\s+FROM/i.test(sqlToRun) && !/COUNT\(\*\)\s+AS\s+/i.test(sqlToRun)) {
    sqlToRun = sqlToRun.replace(/SELECT\s+COUNT\(\*\)\s+FROM/i, 'SELECT COUNT(*) AS count FROM');
  }

  const [result] = await activePool.query(sqlToRun, paramsToRun);

  if (returningMatch) {
    // 1. Insert handling
    if (/^\s*INSERT\s+INTO\s+(\w+)/i.test(sqlToRun)) {
      const match = sqlToRun.match(/^\s*INSERT\s+INTO\s+(\w+)/i);
      const tableName = match[1];

      if (returningFields.toLowerCase() === 'id') {
        return {
          rows: [{ id: result.insertId }],
          rowCount: 1,
        };
      }

      let lookupId = result.insertId;
      if (tableName.toLowerCase() === 'bulk_jobs') {
        lookupId = params[0]; // bulk_jobs uses UUID string in params[0]
      }

      const selectCols = returningFields === '*' ? '*' : returningFields;
      const [fetchedRows] = await activePool.query(
        `SELECT ${selectCols} FROM ${tableName} WHERE id = ?`,
        [lookupId]
      );
      return {
        rows: fetchedRows,
        rowCount: fetchedRows.length,
      };
    }

    // 2. Update handling
    if (/^\s*UPDATE\s+(\w+)/i.test(sqlToRun)) {
      const match = sqlToRun.match(/^\s*UPDATE\s+(\w+)/i);
      const tableName = match[1];
      const [fetchedRows] = await activePool.query(
        `SELECT * FROM ${tableName} WHERE id = ?`,
        [params[0]]
      );
      return {
        rows: fetchedRows,
        rowCount: fetchedRows.length,
      };
    }
  }

  const rows = Array.isArray(result) ? result : [];
  for (const r of rows) {
    if (r && r['COUNT(*)'] !== undefined && r.count === undefined) {
      r.count = r['COUNT(*)'];
    }
  }

  return {
    rows,
    rowCount: Array.isArray(result) ? result.length : (result.affectedRows || 0),
  };
}

/**
 * Execute a parameterized SQL query
 */
async function query(text, params = []) {
  const activePool = pool || initDatabase();
  try {
    if (currentDbType === 'mysql' && !isUsingMemory) {
      return await executeMysqlQuery(activePool, text, params);
    }
    return await activePool.query(text, params);
  } catch (err) {
    // Graceful fallback to memory DB if external DB connection fails
    if (!isUsingMemory && (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ER_ACCESS_DENIED_ERROR' ||
      err.code === 'ER_BAD_DB_ERROR' ||
      err.code === '28P01' ||
      err.message.includes('connect')
    )) {
      console.warn('Connection to database failed. Switching to pg-mem emulator:', err.message);
      pool = setupMemoryDb();
      return await pool.query(text, params);
    }
    throw err;
  }
}

/**
 * Acquire a client for transaction management
 */
async function getClient() {
  const activePool = pool || initDatabase();
  if (currentDbType === 'mysql' && !isUsingMemory) {
    const connection = await activePool.getConnection();
    return {
      query: (sql, params) => executeMysqlQuery(connection, sql, params),
      release: () => connection.release(),
    };
  }
  return await activePool.connect();
}

module.exports = {
  query,
  getClient,
  initDatabase,
  setupMemoryDb,
  isMemoryDb: () => isUsingMemory,
  getDbType: () => currentDbType,
};
