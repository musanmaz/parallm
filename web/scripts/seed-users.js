#!/usr/bin/env node
/**
 * Seed script – creates initial users from the SEED_USERS env variable.
 *
 * Usage:
 *   INITIAL_PASSWORD=<password> SEED_USERS=alice,bob npm run seed
 *
 * If SEED_USERS is not set, defaults to two example accounts: "user1" and "user2".
 * Each user gets the same password defined in INITIAL_PASSWORD.
 */
const bcrypt = require('bcryptjs');
const { query } = require('../lib/db');

const rawUsers = process.env.SEED_USERS || 'user1,user2';
const USERS = rawUsers.split(',').map((u) => ({
  username: u.trim(),
  email: `${u.trim()}@local`,
}));

async function seed() {
  const password = process.env.INITIAL_PASSWORD;
  if (!password || password.length < 6) {
    console.error('INITIAL_PASSWORD (min 6 chars) is required in .env');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  for (const u of USERS) {
    await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password_hash = $3`,
      [u.username, u.email, hash]
    );
    console.log('Seeded user:', u.username);
  }
  console.log(`Seed done. Login with any of [${USERS.map((u) => u.username).join(', ')}] and INITIAL_PASSWORD.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
