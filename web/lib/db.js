const { Pool } = require('pg');

const pool =
  globalThis.__dbPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dbPool = pool;
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('DB query error', { text: text?.substring(0, 100), err: err.message });
    }
    throw err;
  }
}

module.exports = { query, pool };
