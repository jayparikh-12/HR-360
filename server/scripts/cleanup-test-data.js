require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'peoplepay360',
  });

  console.log('=== Cleaning up test/fixture data ===\n');

  // First check what related records exist for test employees
  const [testEmps] = await pool.query(
    `SELECT id, name, email FROM employees WHERE 
      email LIKE 'e2e_flow_%'
      OR email LIKE 'p74_%'
      OR email LIKE 'sec_emp_%'
      OR (name = 'Duplicate Admin' AND email = 'admin@company.com')`
  );
  console.log('Test employees to delete:', testEmps.length);
  testEmps.forEach(e => console.log(' -', e.name, '|', e.email));

  const testIds = testEmps.map(e => e.id);

  if (testIds.length === 0) {
    console.log('No test data found. Database is clean.');
    await pool.end();
    return;
  }

  // Delete dependent records first (FK constraints)
  const placeholders = testIds.map(() => '?').join(',');

  const [payslips] = await pool.query(`DELETE FROM payslips WHERE employee_id IN (${placeholders})`, testIds);
  console.log('Deleted payslips:', payslips.affectedRows);

  const [attendance] = await pool.query(`DELETE FROM attendance_records WHERE employee_id IN (${placeholders})`, testIds);
  console.log('Deleted attendance_records:', attendance.affectedRows);

  const [timeoff] = await pool.query(`DELETE FROM time_off_requests WHERE employee_id IN (${placeholders})`, testIds);
  console.log('Deleted time_off_requests:', timeoff.affectedRows);

  const [contracts] = await pool.query(`DELETE FROM contracts WHERE employee_id IN (${placeholders})`, testIds);
  console.log('Deleted contracts:', contracts.affectedRows);

  // Now delete the test employees
  const [emps] = await pool.query(`DELETE FROM employees WHERE id IN (${placeholders})`, testIds);
  console.log('Deleted employees:', emps.affectedRows);

  // Show what remains
  const [remaining] = await pool.query('SELECT id, name, email, status FROM employees ORDER BY id ASC');
  console.log('\n=== Remaining employees in DB ===');
  remaining.forEach(r => console.log(' ', r.id, '|', r.name.padEnd(20), '|', r.email.padEnd(30), '|', r.status));
  console.log('\nTotal real employees:', remaining.length);

  await pool.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
