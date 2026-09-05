import assert from 'node:assert';

const BASE_URL = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ✔ [PASS] ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`  ✘ [FAIL] ${msg}:`, err);
  failed++;
}

async function run() {
  console.log('================================================================');
  console.log('🧑‍💼 EMPLOYEE GENDER FIELD FULL-STACK INTEGRATION TEST SUITE 👩‍💼');
  console.log('================================================================\n');

  // 1. Authenticate as Admin
  console.log('--- 1. Authentication ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'password123' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const loginData = await loginRes.json();
  const token = loginData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  pass('Admin authenticated and Bearer token acquired');

  // 2. GET /api/employees - Check Gender on seeded employees
  console.log('\n--- 2. GET /api/employees (List Verification) ---');
  const listRes = await fetch(`${BASE_URL}/employees`, { headers: authHeaders });
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  const employees = listData.data;
  assert.ok(Array.isArray(employees), 'Employees list is an array');
  pass(`Retrieved ${employees.length} employees`);

  const john = employees.find(e => e.name === 'John Doe');
  assert.ok(john, 'John Doe found in employee list');
  assert.strictEqual(john.gender, 'MALE', `John Doe gender is MALE (found: ${john.gender})`);
  pass('John Doe has gender MALE');

  const jane = employees.find(e => e.name === 'Jane Smith');
  if (jane) {
    assert.strictEqual(jane.gender, 'FEMALE', `Jane Smith gender is FEMALE (found: ${jane.gender})`);
    pass('Jane Smith has gender FEMALE');
  }

  // 3. GET /api/employees/:id - Check Gender in single employee detail
  console.log('\n--- 3. GET /api/employees/:id (Profile Detail Verification) ---');
  const getOneRes = await fetch(`${BASE_URL}/employees/${john.id}`, { headers: authHeaders });
  assert.strictEqual(getOneRes.status, 200);
  const getOneData = await getOneRes.json();
  assert.strictEqual(getOneData.data.gender, 'MALE', 'GET /api/employees/:id returns gender MALE for John Doe');
  pass('Single employee detail includes gender attribute');

  // 4. POST /api/employees - Validation (Invalid Gender)
  console.log('\n--- 4. POST /api/employees Validation (Invalid Gender) ---');
  const badGenderRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      firstName: 'Invalid',
      lastName: 'GenderTest',
      email: `invalid.gender.${Date.now()}@company.com`,
      department: 'Engineering',
      jobPosition: 'Tester',
      gender: 'ALIEN', // Unsupported gender
    }),
  });
  assert.strictEqual(badGenderRes.status, 400);
  const badGenderData = await badGenderRes.json();
  assert.strictEqual(badGenderData.success, false);
  assert.ok(badGenderData.message.includes('gender must be one of'), `Expected error message about supported genders, got: ${badGenderData.message}`);
  pass('POST /api/employees with invalid gender correctly rejected with 400 Bad Request');

  // 5. POST /api/employees - Creation with Valid Gender
  console.log('\n--- 5. POST /api/employees Creation (Valid Gender) ---');
  const uniqueEmail = `sarah.gender.${Date.now()}@company.com`;
  const createRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      firstName: 'Sarah',
      lastName: 'Connor',
      email: uniqueEmail,
      department: 'Operations',
      jobPosition: 'Security Specialist',
      gender: 'FEMALE',
    }),
  });
  assert.strictEqual(createRes.status, 201);
  const createData = await createRes.json();
  const createdEmp = createData.data;
  assert.ok(createdEmp.id);
  assert.strictEqual(createdEmp.gender, 'FEMALE', `Created employee gender is FEMALE (got: ${createdEmp.gender})`);
  pass(`Created employee ${createdEmp.id} with gender FEMALE`);

  // 6. Persistence Check: Retrieve created employee
  console.log('\n--- 6. Persistence Verification ---');
  const verifyRes = await fetch(`${BASE_URL}/employees/${createdEmp.id}`, { headers: authHeaders });
  assert.strictEqual(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyData.data.gender, 'FEMALE', 'Retrieved employee persists gender FEMALE in database');
  pass('Employee gender confirmed persisted in MySQL');

  // 7. PATCH /api/employees/:id - Validation (Invalid Gender Update)
  console.log('\n--- 7. PATCH /api/employees/:id Validation (Invalid Gender) ---');
  const patchInvalidRes = await fetch(`${BASE_URL}/employees/${createdEmp.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ gender: 'ROBOT' }),
  });
  assert.strictEqual(patchInvalidRes.status, 400);
  pass('PATCH /api/employees/:id with invalid gender correctly rejected with 400 Bad Request');

  // 8. PATCH /api/employees/:id - Update with Valid Gender
  console.log('\n--- 8. PATCH /api/employees/:id Update (Valid Gender) ---');
  const patchValidRes = await fetch(`${BASE_URL}/employees/${createdEmp.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ gender: 'NON_BINARY' }),
  });
  assert.strictEqual(patchValidRes.status, 200);
  const patchData = await patchValidRes.json();
  assert.strictEqual(patchData.data.gender, 'NON_BINARY', `Updated employee gender is NON_BINARY (got: ${patchData.data.gender})`);
  pass('PATCH /api/employees/:id successfully updated gender to NON_BINARY');

  // 9. Persistence Check after Update
  console.log('\n--- 9. Persistence Check after Update ---');
  const verifyPatchRes = await fetch(`${BASE_URL}/employees/${createdEmp.id}`, { headers: authHeaders });
  assert.strictEqual(verifyPatchRes.status, 200);
  const verifyPatchData = await verifyPatchRes.json();
  assert.strictEqual(verifyPatchData.data.gender, 'NON_BINARY', 'Updated gender persisted in MySQL');
  pass('Updated gender confirmed persisted after re-fetch');

  // 10. Backward Compatibility: POST without Gender
  console.log('\n--- 10. Backward Compatibility: POST without Gender ---');
  const noGenderEmail = `nogender.${Date.now()}@company.com`;
  const noGenderRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      firstName: 'No',
      lastName: 'GenderSpecified',
      email: noGenderEmail,
      department: 'Finance',
      jobPosition: 'Analyst',
    }),
  });
  assert.strictEqual(noGenderRes.status, 201);
  const noGenderData = await noGenderRes.json();
  assert.strictEqual(noGenderData.data.gender, null, 'Employee without specified gender defaults to null');
  pass('Backward compatibility: POST without gender succeeds with null default');

  console.log('\n================================================================');
  console.log(`GENDER INTEGRATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
