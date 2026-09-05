import mysql from '../server/node_modules/mysql2/promise.js';

const BASE_URL = 'http://localhost:5000/api';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Jay@1234',
  database: process.env.DB_NAME || 'peoplepay360',
};

async function main() {
  console.log('=== Starting Phase 3 Employee Integration Verification ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Authenticate to obtain token
  console.log('1. Authenticating as admin...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.data?.token;
  assert(loginRes.status === 200 && Boolean(token), 'Login successful and JWT received');

  // 2. Unauthenticated check (401)
  console.log('\n2. Testing unauthenticated access (401)...');
  const unauthGetRes = await fetch(`${BASE_URL}/employees`);
  assert(unauthGetRes.status === 401, 'GET /api/employees without token returns 401');

  const unauthPostRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Test', lastName: 'User', email: 'unauth@example.com' })
  });
  assert(unauthPostRes.status === 401, 'POST /api/employees without token returns 401');

  // 3. GET /api/employees (200)
  console.log('\n3. Testing GET /api/employees...');
  const getEmployeesRes = await fetch(`${BASE_URL}/employees`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getEmployeesData = await getEmployeesRes.json();
  assert(getEmployeesRes.status === 200, 'GET /api/employees returns 200');
  assert(Array.isArray(getEmployeesData.data), 'Returns array of employees');
  assert(getEmployeesData.data.length >= 12, `Returned ${getEmployeesData.data.length} employees (>= 12 expected)`);
  
  const sample = getEmployeesData.data[0];
  assert(sample && sample.id && sample.name && sample.email && sample.department && sample.status,
    `Employee shape is complete: id=${sample.id}, name=${sample.name}, dept=${sample.department}, status=${sample.status}`);

  // 4. POST /api/employees - validation errors (400)
  console.log('\n4. Testing POST /api/employees validation (400)...');
  const badPostRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ firstName: 'MissingFields' })
  });
  assert(badPostRes.status === 400, 'POST /api/employees missing required fields returns 400');

  // 5. POST /api/employees - create new employee (201)
  console.log('\n5. Testing POST /api/employees creation (201)...');
  const testEmail = `phase3.test.${Date.now()}@peoplepay360.com`;
  const createRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      firstName: 'Integration',
      lastName: 'Tester',
      email: testEmail,
      department: 'Engineering',
      jobPosition: 'QA Automation Engineer',
      workingSchedule: 'Standard 40h',
      status: 'ACTIVE'
    })
  });
  const createData = await createRes.json();
  assert(createRes.status === 201, `POST /api/employees returns 201 (status=${createRes.status})`);
  assert(createData.data?.email === testEmail, `Returned employee email matches (${createData.data?.email})`);
  const createdId = createData.data?.id;
  assert(Boolean(createdId), `Created employee has ID: ${createdId}`);

  // 6. POST /api/employees - duplicate email conflict (409)
  console.log('\n6. Testing duplicate email (409)...');
  const dupRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      firstName: 'Integration',
      lastName: 'Tester',
      email: testEmail,
      department: 'Engineering',
      jobPosition: 'QA Automation Engineer'
    })
  });
  assert(dupRes.status === 409, `Duplicate email returns 409 Conflict (status=${dupRes.status})`);

  // 7. GET /api/employees/:id (200)
  console.log('\n7. Testing GET /api/employees/:id...');
  const getOneRes = await fetch(`${BASE_URL}/employees/${createdId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getOneData = await getOneRes.json();
  assert(getOneRes.status === 200, `GET /api/employees/${createdId} returns 200`);
  assert(getOneData.data?.name === 'Integration Tester', `Employee name is Integration Tester`);
  assert(getOneData.data?.department === 'Engineering', `Department is Engineering`);

  // 8. PATCH /api/employees/:id (200)
  console.log('\n8. Testing PATCH /api/employees/:id...');
  const patchRes = await fetch(`${BASE_URL}/employees/${createdId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      jobPosition: 'Lead QA Engineer',
      department: 'Quality Assurance',
      status: 'INACTIVE',
      workingSchedule: 'Remote 40h'
    })
  });
  const patchData = await patchRes.json();
  assert(patchRes.status === 200, `PATCH /api/employees/${createdId} returns 200`);
  assert(patchData.data?.position === 'Lead QA Engineer', `Updated position is Lead QA Engineer`);
  assert(patchData.data?.department === 'Quality Assurance', `Updated department is Quality Assurance`);
  assert(patchData.data?.status === 'TERMINATED', `Updated status normalized to TERMINATED`);
  assert(patchData.data?.schedule === 'Remote 40h', `Updated schedule is Remote 40h`);

  // Verify in MySQL
  const db = await mysql.createConnection(dbConfig);
  const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [createdId]);
  assert(rows.length === 1, `Employee found directly in MySQL table`);
  assert(rows[0].jobPosition === 'Lead QA Engineer', `MySQL jobPosition matches updated value`);
  assert(rows[0].status === 'INACTIVE', `MySQL status matches updated value`);
  assert(rows[0].workingSchedule === 'Remote 40h', `MySQL workingSchedule matches updated value`);

  // 9. PATCH validation (400 for bad status, 404 for missing id)
  console.log('\n9. Testing PATCH error handling...');
  const badPatchRes = await fetch(`${BASE_URL}/employees/${createdId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'INVALID_STATUS' })
  });
  assert(badPatchRes.status === 400, `Invalid status in PATCH returns 400`);

  const notFoundPatchRes = await fetch(`${BASE_URL}/employees/nonexistent-uuid-1234`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    method: 'PATCH',
    body: JSON.stringify({ department: 'Sales' })
  });
  assert(notFoundPatchRes.status === 404, `PATCH nonexistent employee returns 404`);

  // 10. Clean up test employee
  console.log('\n10. Cleaning up test employee from MySQL...');
  await db.query('DELETE FROM employees WHERE id = ?', [createdId]);
  const [checkRows] = await db.query('SELECT * FROM employees WHERE id = ?', [createdId]);
  assert(checkRows.length === 0, `Test employee successfully purged from MySQL`);
  await db.end();

  // 11. Regression Check: Other Endpoints
  console.log('\n11. Verifying other system endpoints remain functional...');
  const endpoints = [
    { name: 'Contracts', path: '/contracts' },
    { name: 'Attendance', path: '/attendance' },
    { name: 'Time Off', path: '/time-off' },
    { name: 'Salary Structures', path: '/salary-structures' },
    { name: 'Salary Rules', path: '/salary-rules' },
    { name: 'Payroll Runs', path: '/payroll/payruns' }
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(res.status === 200, `Regression: GET ${ep.path} returns 200`);
  }

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
