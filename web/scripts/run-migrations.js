#!/usr/bin/env node
const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { pool } = require('../lib/db');

const migrationsDir = join(__dirname, '../db/migrations');

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    console.log('Running', file);
    await pool.query(sql);
  }
  console.log('Migrations done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
