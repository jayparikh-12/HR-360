import mysql from 'mysql2/promise';

async function main() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'peoplepay360',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Tables:', JSON.stringify(tables, null, 2));
    
    // Check working_schedules schema
    try {
      const [schema] = await pool.query('SHOW CREATE TABLE working_schedules');
      console.log('working_schedules schema:', JSON.stringify(schema, null, 2));
    } catch(e) {
      console.log('working_schedules table does not exist or error:', e.message);
    }
    
    // Check contracts schema
    try {
      const [schema] = await pool.query('SHOW CREATE TABLE contracts');
      console.log('contracts schema:', JSON.stringify(schema, null, 2));
    } catch(e) {
      console.log('contracts table error:', e.message);
    }
    
    // Check employees schema
    try {
      const [schema] = await pool.query('SHOW CREATE TABLE employees');
      console.log('employees schema:', JSON.stringify(schema, null, 2));
    } catch(e) {
      console.log('employees table error:', e.message);
    }
    
    await pool.end();
  } catch(e) {
    console.error('Database error:', e);
  }
}

main();