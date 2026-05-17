#!/usr/bin/env node
/**
 * csbot_admin — Database Initialization Script
 * 1. Creates all Drizzle schema tables
 * 2. Creates initial admin account
 * 3. Generates JWT_SECRET if missing
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema.js";

const {
  DATABASE_URL,
  JWT_SECRET,
  ADMIN_USERNAME = "admin",
  ADMIN_PASSWORD = "changeme123",
  ADMIN_PASSWORD_HASH,
  PRIVATE_API_KEY,
} = process.env;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  console.error("Example: mysql://root:password@127.0.0.1:3306/csbot");
  process.exit(1);
}

// Parse DATABASE_URL
function parseMySqlUrl(url) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error(`Invalid DATABASE_URL: ${url}`);
  return { user: match[1], password: match[2], host: match[3], port: parseInt(match[4]), database: match[5] };
}

async function initDb() {
  const dbConfig = parseMySqlUrl(DATABASE_URL);
  const dbName = dbConfig.database;
  const connectionConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  };

  // Connect without database to create it
  const initConn = await mysql.createConnection(connectionConfig);
  await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await initConn.end();
  console.log(`Database '${dbName}' ready`);

  // Connect to the database
  const db = drizzle(await mysql.createConnection({ ...connectionConfig, database: dbName }), { schema });

  // Create all tables via raw SQL (safe, non-destructive)
  const migrations = [
    // admins table
    `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Users table (extend existing)
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active'`,
  ];

  for (const sql of migrations) {
    try {
      await initConn.query(sql);
    } catch (err) {
      // Ignore "duplicate column" and "duplicate key" errors
      if (!err.message.includes("Duplicate") && !err.message.includes("already exists")) {
        console.warn(`Migration warning: ${err.message}`);
      }
    }
  }

  // Create initial admin
  const passwordHash = ADMIN_PASSWORD_HASH
    || await bcrypt.hash(ADMIN_PASSWORD, 12);

  await initConn.query(
    `INSERT INTO admins (username, password_hash, role) VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = ?, role = 'admin'`,
    [ADMIN_USERNAME, passwordHash, passwordHash]
  );
  console.log(`Admin account: ${ADMIN_USERNAME} (password: ${ADMIN_PASSWORD})`);

  // Generate JWT_SECRET if missing
  const secret = JWT_SECRET || crypto.randomBytes(48).toString("hex");
  if (!JWT_SECRET) {
    console.log(`\nGenerated JWT_SECRET (add to .env):\nJWT_SECRET=${secret}\n`);
  }

  // Generate PRIVATE_API_KEY if missing
  const apiKey = PRIVATE_API_KEY || crypto.randomBytes(32).toString("hex");
  if (!PRIVATE_API_KEY) {
    console.log(`Generated PRIVATE_API_KEY (add to .env):\nPRIVATE_API_KEY=${apiKey}\n`);
  }

  await initConn.end();
  console.log("\nDatabase initialization complete!");
  console.log(`\n.env should include:\nJWT_SECRET=${secret}\nPRIVATE_API_KEY=${apiKey}`);
}

initDb().catch(err => {
  console.error("Init failed:", err);
  process.exit(1);
});
