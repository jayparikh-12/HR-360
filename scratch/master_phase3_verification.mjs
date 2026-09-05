import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('================================================================');
  console.log('🚀 MASTER FULL INTEGRATION VERIFICATION SUITE — PEOPLEPAY360 🚀');
  console.log('================================================================\n');

  let totalAssertions = 0;
  function pass(msg) {
    totalAssertions++;
    console.log(`  ✔ [PASS] ${msg}`);
  }

  // --------------------------------------------------------------------------
  // TASK 1: Authentication Protection Across All Integrated APIs
  // --------------------------------------------------------------------------
  console.log('--- 1. Authentication Protection & Session Lifecycle ---');

  const endpoints = [
    '/employees',
    '/contracts',
    '/schedules',
    '/attendance',
    '/time-off',
    '/salary-structures',
    '/salary-rules',
    '/payroll/payruns',
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`);
    assert.strictEqual(res.status, 401, `Unauthenticated ${ep} should return 401`);
    pass(`Unauthenticated GET ${ep} returns 401 Unauthorized`);
  }

  // Invalid Token Check
  const badAuthRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: 'Bearer totally_invalid_or_expired_jwt_token_123' },
  });
  assert.strictEqual(badAuthRes.status, 401);
  pass('Invalid/expired JWT token returns 401 Unauthorized on /api/auth/me');

  // Admin Login
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'password123' }),
  });
  assert.strictEqual(adminLoginRes.status, 200);
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.token;
  assert.ok(adminToken, 'Admin token should be present in login response');
  pass('Admin login successful and signed Bearer token issued');

  // Session Restoration Verification via /api/auth/me
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(meRes.status, 200);
  const meData = await meRes.json();
  assert.strictEqual(meData.user.role, 'Admin');
  pass('Session restoration (/api/auth/me) restores user identity and Admin role');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // --------------------------------------------------------------------------
  // TASK 2: Employee Integration & RBAC Guardrails
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Employee Integration & RBAC Guardrails ---');

  // Non-admin check
  const empLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'john@company.com', password: 'password123' }),
  });
  assert.strictEqual(empLoginRes.status, 200);
  const empToken = (await empLoginRes.json()).token;

  const nonAdminPost = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
    body: JSON.stringify({ name: 'Hacker', email: 'hack@test.com', department: 'IT', jobPosition: 'Dev' }),
  });
  assert.strictEqual(nonAdminPost.status, 403);
  pass('Non-admin user blocked from POST /api/employees with 403 Forbidden');

  const nonAdminPatch = await fetch(`${BASE_URL}/employees/EMP-001`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
    body: JSON.stringify({ department: 'Unauthorized Dept' }),
  });
  assert.strictEqual(nonAdminPatch.status, 403);
  pass('Non-admin user blocked from PATCH /api/employees/:id with 403 Forbidden');

  // List employees
  const listEmpsRes = await fetch(`${BASE_URL}/employees`, { headers: authHeaders });
  assert.strictEqual(listEmpsRes.status, 200);
  const allEmployees = (await listEmpsRes.json()).data;
  assert.ok(Array.isArray(allEmployees) && allEmployees.length >= 6);
  pass(`GET /api/employees lists ${allEmployees.length} employees`);

  // Employee details
  const empDetailRes = await fetch(`${BASE_URL}/employees/EMP-001`, { headers: authHeaders });
  assert.strictEqual(empDetailRes.status, 200);
  const empDetail = (await empDetailRes.json()).data;
  assert.strictEqual(empDetail.id, 'EMP-001');
  assert.strictEqual(empDetail.name, 'John Doe');
  pass(`GET /api/employees/:id returns details for ${empDetail.name}`);

  // Create Employee
  const uniqueEmpEmail = `full.integ.${Date.now()}@company.com`;
  const createEmpRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      firstName: 'E2E',
      lastName: 'Full Tester',
      email: uniqueEmpEmail,
      department: 'Engineering',
      jobPosition: 'Senior Architect',
      status: 'ACTIVE',
    }),
  });
  assert.strictEqual(createEmpRes.status, 201);
  const createdEmp = (await createEmpRes.json()).data;
  assert.ok(createdEmp.id);
  pass(`Admin POST /api/employees created employee ${createdEmp.id} (${createdEmp.name})`);

  // Update Employee
  const patchEmpRes = await fetch(`${BASE_URL}/employees/${createdEmp.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      department: 'Platform Engineering',
      position: 'Principal Architect',
    }),
  });
  assert.strictEqual(patchEmpRes.status, 200);
  const patchedEmp = (await patchEmpRes.json()).data;
  assert.strictEqual(patchedEmp.department, 'Platform Engineering');
  pass(`Admin PATCH /api/employees/:id updated department to ${patchedEmp.department}`);

  // --------------------------------------------------------------------------
  // TASK 3: Contract Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Contract Integration ---');

  const contractsRes = await fetch(`${BASE_URL}/contracts`, { headers: authHeaders });
  assert.strictEqual(contractsRes.status, 200);
  const contractsList = (await contractsRes.json()).data;
  assert.ok(Array.isArray(contractsList) && contractsList.length > 0);
  pass(`GET /api/contracts returns ${contractsList.length} contracts`);

  const singleContract = contractsList[0];
  const contractDetailRes = await fetch(`${BASE_URL}/contracts/${singleContract.id}`, { headers: authHeaders });
  assert.strictEqual(contractDetailRes.status, 200);
  const contractDetail = (await contractDetailRes.json()).data;
  assert.strictEqual(contractDetail.id, singleContract.id);
  pass(`GET /api/contracts/:id returns details for ${contractDetail.id}`);

  // Fetch schedules to get a valid schedule ID
  const schedsForContract = await (await fetch(`${BASE_URL}/schedules`, { headers: authHeaders })).json();
  const validScheduleId = schedsForContract.data[0]?.id || 'SCH-001';

  // Create Contract for newly created employee
  const createContractRes = await fetch(`${BASE_URL}/contracts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: createdEmp.id,
      wage: 8500,
      startDate: '2026-09-01',
      salaryStructureId: 'STR-001',
      workingScheduleId: validScheduleId,
      status: 'ACTIVE',
    }),
  });
  assert.strictEqual(createContractRes.status, 201);
  const createdContract = (await createContractRes.json()).data;
  assert.strictEqual(createdContract.employeeId, createdEmp.id);
  pass(`POST /api/contracts created contract ${createdContract.id} for ${createdEmp.id} with wage $${createdContract.wage}`);

  // Active contract conflict test (409)
  const duplicateActiveRes = await fetch(`${BASE_URL}/contracts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: createdEmp.id,
      wage: 9000,
      startDate: '2026-09-15',
      status: 'ACTIVE',
    }),
  });
  assert.strictEqual(duplicateActiveRes.status, 409);
  pass('Creating a second ACTIVE contract for same employee rejected with 409 Conflict');

  // --------------------------------------------------------------------------
  // TASK 4: Working Schedule Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Working Schedule Integration ---');

  const schedulesRes = await fetch(`${BASE_URL}/schedules`, { headers: authHeaders });
  assert.strictEqual(schedulesRes.status, 200);
  const schedulesList = (await schedulesRes.json()).data;
  assert.ok(Array.isArray(schedulesList) && schedulesList.length > 0);
  pass(`GET /api/schedules returns ${schedulesList.length} schedules`);

  const schedDetailRes = await fetch(`${BASE_URL}/schedules/${encodeURIComponent(schedulesList[0].id || schedulesList[0].name)}`, { headers: authHeaders });
  assert.strictEqual(schedDetailRes.status, 200);
  pass(`GET /api/schedules/:id returns details for schedule`);

  const uniqueSchedName = `Master Schedule ${Date.now()}`;
  const createSchedRes = await fetch(`${BASE_URL}/schedules`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: uniqueSchedName,
      workingHours: '36h',
    }),
  });
  assert.strictEqual(createSchedRes.status, 201);
  pass(`POST /api/schedules created schedule "${uniqueSchedName}"`);

  // --------------------------------------------------------------------------
  // TASK 5: Attendance Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Attendance Integration ---');

  const attendanceRes = await fetch(`${BASE_URL}/attendance`, { headers: authHeaders });
  assert.strictEqual(attendanceRes.status, 200);
  const attendanceList = (await attendanceRes.json()).data;
  assert.ok(Array.isArray(attendanceList));
  pass(`GET /api/attendance returns ${attendanceList.length} records`);

  // Check in for the new employee
  const checkInRes = await fetch(`${BASE_URL}/attendance/check-in`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: createdEmp.id,
      date: '2026-10-15',
      status: 'PRESENT',
    }),
  });
  assert.strictEqual(checkInRes.status, 201);
  const checkInRecord = (await checkInRes.json()).data;
  pass(`POST /api/attendance/check-in recorded attendance ${checkInRecord.id} for ${createdEmp.id}`);

  // Duplicate active check-in rejection (409)
  const dupCheckInRes = await fetch(`${BASE_URL}/attendance/check-in`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: createdEmp.id,
      date: '2026-10-15',
    }),
  });
  assert.strictEqual(dupCheckInRes.status, 409);
  pass('Duplicate active check-in for same employee & date rejected with 409 Conflict');

  // Check out
  const checkOutRes = await fetch(`${BASE_URL}/attendance/check-out`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      recordId: checkInRecord.id,
    }),
  });
  assert.strictEqual(checkOutRes.status, 200);
  pass(`POST /api/attendance/check-out successfully clocked out record ${checkInRecord.id}`);

  // --------------------------------------------------------------------------
  // TASK 6: Time Off Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Time Off Integration ---');

  const timeOffListRes = await fetch(`${BASE_URL}/time-off`, { headers: authHeaders });
  assert.strictEqual(timeOffListRes.status, 200);
  const timeOffList = (await timeOffListRes.json()).data;
  assert.ok(Array.isArray(timeOffList));
  pass(`GET /api/time-off returns ${timeOffList.length} requests`);

  // Create request for created employee
  const createTORes = await fetch(`${BASE_URL}/time-off`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: createdEmp.id,
      leaveType: 'Paid Time Off',
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      durationDays: 3,
      reason: 'E2E Full Verification Leave',
    }),
  });
  assert.strictEqual(createTORes.status, 201);
  const createdTO = (await createTORes.json()).data;
  pass(`POST /api/time-off submitted request ${createdTO.id} in PENDING state`);

  // Approve request
  const approveTORes = await fetch(`${BASE_URL}/time-off/${createdTO.id}/approve`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(approveTORes.status, 200);
  pass(`PATCH /api/time-off/:id/approve approved request ${createdTO.id}`);

  // Invalid transition: Approving an already approved request (409)
  const doubleApprove = await fetch(`${BASE_URL}/time-off/${createdTO.id}/approve`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(doubleApprove.status, 409);
  pass('Double approval on already approved Time Off rejected with 409 Conflict');

  // Refusal flow on a second request
  const createTO2Res = await fetch(`${BASE_URL}/time-off`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeId: createdEmp.id,
      leaveType: 'Unpaid Leave',
      startDate: '2026-11-10',
      endDate: '2026-11-11',
      durationDays: 2,
    }),
  });
  assert.strictEqual(createTO2Res.status, 201);
  const createdTO2 = (await createTO2Res.json()).data;

  const refuseTORes = await fetch(`${BASE_URL}/time-off/${createdTO2.id}/refuse`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(refuseTORes.status, 200);
  pass(`PATCH /api/time-off/:id/refuse refused request ${createdTO2.id}`);

  // --------------------------------------------------------------------------
  // TASK 7: Salary Structure Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Salary Structure Integration ---');

  const structListRes = await fetch(`${BASE_URL}/salary-structures`, { headers: authHeaders });
  assert.strictEqual(structListRes.status, 200);
  const structures = (await structListRes.json()).data;
  assert.ok(Array.isArray(structures) && structures.length > 0);
  pass(`GET /api/salary-structures returns ${structures.length} structures with contract counts`);

  const uniqueStructCode = `STR_${Date.now().toString().slice(-6)}`;
  const createStructRes = await fetch(`${BASE_URL}/salary-structures`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Structure ${uniqueStructCode}`,
      code: uniqueStructCode,
      baseWage: 5000,
    }),
  });
  assert.strictEqual(createStructRes.status, 201);
  const createdStruct = (await createStructRes.json()).data;
  pass(`POST /api/salary-structures created structure ${createdStruct.id} (${createdStruct.code})`);

  // Structure Detail
  const structDetailRes = await fetch(`${BASE_URL}/salary-structures/${createdStruct.id}`, { headers: authHeaders });
  assert.strictEqual(structDetailRes.status, 200);
  pass(`GET /api/salary-structures/:id returned details for ${createdStruct.id}`);

  // --------------------------------------------------------------------------
  // TASK 8: Salary Rules Integration & Sequence Ordering
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Salary Rules Integration & Sequence Ordering ---');

  const rulesListRes = await fetch(`${BASE_URL}/salary-rules`, { headers: authHeaders });
  assert.strictEqual(rulesListRes.status, 200);
  const rules = (await rulesListRes.json()).data;
  assert.ok(Array.isArray(rules) && rules.length > 0);
  pass(`GET /api/salary-rules returns ${rules.length} total rules`);

  // Create rules in reverse sequence order to test sequence sorting
  await fetch(`${BASE_URL}/salary-rules`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      structureId: createdStruct.id,
      name: 'Net Pay Rule',
      code: `NET_${uniqueStructCode}`,
      sequence: 90,
      category: 'NET',
      calculationType: 'FORMULA',
      formula: 'GROSS - DEDUCTION',
    }),
  });

  await fetch(`${BASE_URL}/salary-rules`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      structureId: createdStruct.id,
      name: 'Basic Pay Rule',
      code: `BSC_${uniqueStructCode}`,
      sequence: 10,
      category: 'BASIC',
      calculationType: 'PERCENTAGE',
      percentage: 60,
    }),
  });

  const orderedRulesRes = await fetch(`${BASE_URL}/salary-rules?structureId=${createdStruct.id}`, { headers: authHeaders });
  assert.strictEqual(orderedRulesRes.status, 200);
  const orderedRules = (await orderedRulesRes.json()).data;
  assert.strictEqual(orderedRules.length, 2);
  assert.strictEqual(orderedRules[0].sequence, 10);
  assert.strictEqual(orderedRules[1].sequence, 90);
  pass('GET /api/salary-rules?structureId=... returns rules strictly ordered by sequence ASC (10 -> 90)');

  // --------------------------------------------------------------------------
  // TASK 9: Payrun Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Payrun Integration ---');

  const payrunListRes = await fetch(`${BASE_URL}/payroll/payruns`, { headers: authHeaders });
  assert.strictEqual(payrunListRes.status, 200);
  const payruns = (await payrunListRes.json()).data;
  assert.ok(Array.isArray(payruns) && payruns.length > 0);
  pass(`GET /api/payroll/payruns lists ${payruns.length} payruns`);

  // Payrun create
  const uniquePayrunId = `PR-E2E-${Date.now()}`;
  const createPayrunRes = await fetch(`${BASE_URL}/payroll/payruns/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: uniquePayrunId,
      name: `Master Verification Payrun ${uniquePayrunId}`,
      period: '2026-10-01 - 2026-10-31',
      salaryStructure: 'Standard Full-Time Tech',
      employeeIds: ['EMP-001', 'EMP-002'],
    }),
  });
  assert.strictEqual(createPayrunRes.status, 201);
  const createdPayrun = (await createPayrunRes.json()).data;
  assert.strictEqual(createdPayrun.status, 'DRAFT');
  pass(`POST /api/payroll/payruns/create created payrun ${createdPayrun.id} in DRAFT status`);

  // Invalid transition: Cannot pay a DRAFT payrun directly
  const invalidPayRes = await fetch(`${BASE_URL}/payroll/payruns/${createdPayrun.id}/pay`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(invalidPayRes.status, 400);
  pass('Invalid transition (Paying a DRAFT payrun) rejected with 400 Bad Request');

  // Validate payrun
  const valPayrunRes = await fetch(`${BASE_URL}/payroll/payruns/${createdPayrun.id}/validate`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(valPayrunRes.status, 200);
  const validatedPayrun = (await valPayrunRes.json()).data;
  assert.strictEqual(validatedPayrun.status, 'VALIDATED');
  pass(`PATCH /api/payroll/payruns/:id/validate confirmed status transition: DRAFT -> VALIDATED`);

  // Double validation rejected
  const doubleValRes = await fetch(`${BASE_URL}/payroll/payruns/${createdPayrun.id}/validate`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(doubleValRes.status, 400);
  pass('Double validation on already VALIDATED payrun rejected with 400 Bad Request');

  // Mark Paid & Disburse
  const payPayrunRes = await fetch(`${BASE_URL}/payroll/payruns/${createdPayrun.id}/pay`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(payPayrunRes.status, 200);
  const paidPayrun = (await payPayrunRes.json()).data;
  assert.strictEqual(paidPayrun.status, 'PAID');
  pass(`PATCH /api/payroll/payruns/:id/pay confirmed status transition: VALIDATED -> PAID`);

  // Double payment rejected
  const doublePayRes = await fetch(`${BASE_URL}/payroll/payruns/${createdPayrun.id}/pay`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  assert.strictEqual(doublePayRes.status, 400);
  pass('Double payment on already PAID payrun rejected with 400 Bad Request');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🎉 ALL ${totalAssertions} ASSERTIONS IN MASTER VERIFICATION SUITE PASSED! 🎉`);
  console.log('================================================================\n');

  return { createdEmpId: createdEmp.id, createdContractId: createdContract.id, createdPayrunId: createdPayrun.id };
}

run().catch((err) => {
  console.error('\n❌ MASTER VERIFICATION FAILED:', err);
  process.exit(1);
});
