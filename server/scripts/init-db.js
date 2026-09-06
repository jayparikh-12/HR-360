import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'peoplepay360';

async function run() {
  console.log(`Connecting to MySQL at ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);
  const rootConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await rootConn.query(`USE \`${DB_NAME}\`;`);

  const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
  const seedsPath = path.resolve(__dirname, '../../db/seeds.sql');

  if (fs.existsSync(schemaPath)) {
    console.log('Applying db/schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await rootConn.query(schemaSql);
    console.log('Schema applied successfully.');
  }

  const [existingEmployees] = await rootConn.query('SELECT COUNT(*) as count FROM employees');
  if (existingEmployees[0].count === 0 && fs.existsSync(seedsPath)) {
    console.log('Database empty. Applying db/seeds.sql...');
    const seedsSql = fs.readFileSync(seedsPath, 'utf8');
    await rootConn.query(seedsSql);
    console.log('Seeds applied successfully.');
  } else {
    console.log(`Employees already present (${existingEmployees[0].count} records), skipping seed insertion.`);
  }

  const [tables] = await rootConn.query('SHOW TABLES');
  console.log(`Database '${DB_NAME}' initialized successfully with tables:`, tables.map(r => Object.values(r)[0]));

  await rootConn.end();
}

run().catch((err) => {
  console.error('Error initializing database:', err);
  process.exit(1);
});
