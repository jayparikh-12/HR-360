import mysql from 'mysql2/promise';

async function main() {
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'peoplepay360',
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
      console.log('working_schedules table does not exist or error:', (e as Error).message);
    }
    
    // Check contracts schema
    try {
      const [schema] = await pool.query('SHOW CREATE TABLE contracts');
      console.log('contracts schema:', JSON.stringify(schema, null, 2));
    } catch(e) {
      console.log('contracts table error:', (e as Error).message);
    }
    
    // Check employees schema
    try {
      const [schema] = await pool.query('SHOW CREATE TABLE employees');
      console.log('employees schema:', JSON.stringify(schema, null, 2));
    } catch(e) {
      console.log('employees table error:', (e as Error).message);
    }
    
    await pool.end();
  } catch(e) {
    console.error('Database error:', e);
  }
}

main();