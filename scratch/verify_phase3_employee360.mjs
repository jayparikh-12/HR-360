const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('=== Starting Phase 3 Employee 360 Verification ===\n');

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
  assert(loginRes.status === 200 && Boolean(token), 'Admin authentication successful and JWT received');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Fetch Employee List to select Employee A and Employee B
  console.log('\n2. Retrieving employees list...');
  const empsRes = await fetch(`${BASE_URL}/employees`, { headers: authHeaders });
  const empsData = await empsRes.json();
  assert(empsRes.status === 200 && Array.isArray(empsData.data), 'GET /api/employees returns array of employees');
  
  const johnDoe = empsData.data.find(e => e.name === 'John Doe');
  const empB = empsData.data.find(e => e.name === 'Jane Smith' || e.name === 'Maya Lin');
  assert(Boolean(johnDoe), 'Found Employee A (John Doe) in database');
  assert(Boolean(empB), `Found Employee B (${empB?.name || 'Jane Smith'}) in database`);

  // 3. Employee Profile Fetch (GET /api/employees/:id)
  console.log('\n3. Testing Employee Profile fetch (GET /api/employees/:id)...');
  const johnProfileRes = await fetch(`${BASE_URL}/employees/${johnDoe.id}`, { headers: authHeaders });
  const johnProfile = (await johnProfileRes.json()).data;
  assert(johnProfileRes.status === 200, 'GET /api/employees/:id returns 200');
  assert(johnProfile.id === johnDoe.id, `Profile ID matches requested ID (${johnDoe.id})`);
  assert(johnProfile.name === 'John Doe', 'Profile name is John Doe');
  assert(Boolean(johnProfile.department), `Department populated: ${johnProfile.department}`);
  assert(Boolean(johnProfile.position), `Position populated: ${johnProfile.position}`);
  assert(Boolean(johnProfile.status), `Status populated: ${johnProfile.status}`);

  // 4. Contract Association
  console.log('\n4. Testing Contract Association...');
  const contractsRes = await fetch(`${BASE_URL}/contracts`, { headers: authHeaders });
  const contractsData = await contractsRes.json();
  assert(contractsRes.status === 200 && Array.isArray(contractsData.data), 'GET /api/contracts returns 200');
  
  const johnContracts = contractsData.data.filter(
    c => c.employeeId === johnDoe.id || (johnDoe.activeContractId && c.id === johnDoe.activeContractId) || c.employeeName === johnDoe.name
  );
  assert(johnContracts.length > 0, `John Doe has ${johnContracts.length} contract(s)`);
  assert(johnContracts[0].id === 'CON-001', 'John Doe contract is CON-001');
  assert(johnContracts[0].wage === 6500, 'John Doe contract wage is $6500');

  // 5. Working Schedule Association
  console.log('\n5. Testing Working Schedule Association...');
  const schedulesRes = await fetch(`${BASE_URL}/schedules`, { headers: authHeaders });
  const schedulesData = await schedulesRes.json();
  assert(schedulesRes.status === 200 && Array.isArray(schedulesData.data), 'GET /api/schedules returns 200');
  
  // 6. Attendance Filtering & Isolation
  console.log('\n6. Testing Attendance Scoping & Isolation...');
  const attRes = await fetch(`${BASE_URL}/attendance`, { headers: authHeaders });
  const attData = await attRes.json();
  assert(attRes.status === 200 && Array.isArray(attData.data), 'GET /api/attendance returns 200');
  
  const johnAtt = attData.data.filter(
    a => a.employeeId === johnDoe.id || a.employeeName === johnDoe.name
  );
  const empBAtt = attData.data.filter(
    a => a.employeeId === empB.id || a.employeeName === empB.name
  );
  assert(johnAtt.length > 0, `Found ${johnAtt.length} attendance record(s) for John Doe`);
  assert(empBAtt.length > 0, `Found ${empBAtt.length} attendance record(s) for ${empB.name}`);
  assert(
    !johnAtt.some(a => a.employeeName === empB.name),
    `Isolation check: John Doe attendance does NOT contain ${empB.name} records`
  );
  assert(
    !empBAtt.some(a => a.employeeName === 'John Doe'),
    `Isolation check: ${empB.name} attendance does NOT contain John Doe records`
  );

  // 7. Time Off Filtering & Isolation
  console.log('\n7. Testing Time Off Scoping & Isolation...');
  const toRes = await fetch(`${BASE_URL}/time-off`, { headers: authHeaders });
  const toData = await toRes.json();
  assert(toRes.status === 200 && Array.isArray(toData.data), 'GET /api/time-off returns 200');
  
  const johnTo = toData.data.filter(
    t => t.employeeId === johnDoe.id || t.employeeName === johnDoe.name
  );
  const empBTo = toData.data.filter(
    t => t.employeeId === empB.id || t.employeeName === empB.name
  );
  assert(johnTo.length > 0, `Found ${johnTo.length} time off request(s) for John Doe`);
  assert(empBTo.length > 0, `Found ${empBTo.length} time off request(s) for ${empB.name}`);
  assert(
    !johnTo.some(t => t.employeeName === empB.name),
    `Isolation check: John Doe time-off does NOT contain ${empB.name} records`
  );
  assert(
    !empBTo.some(t => t.employeeName === 'John Doe'),
    `Isolation check: ${empB.name} time-off does NOT contain John Doe records`
  );

  // 8. Salary Structure & Rules Association
  console.log('\n8. Testing Salary Structure & Rules Association...');
  const structRes = await fetch(`${BASE_URL}/salary-structures`, { headers: authHeaders });
  const structData = await structRes.json();
  assert(structRes.status === 200 && Array.isArray(structData.data), 'GET /api/salary-structures returns 200');
  
  const structRef = johnContracts[0].salaryStructure;
  const matchedStruct = structData.data.find(s => s.id === structRef || s.code === structRef || s.name === structRef);
  assert(Boolean(matchedStruct), `Matched structure for John Doe: ${matchedStruct?.name} (${matchedStruct?.id})`);

  const rulesRes = await fetch(`${BASE_URL}/salary-rules?structureId=${matchedStruct.id}`, { headers: authHeaders });
  const rulesData = await rulesRes.json();
  assert(rulesRes.status === 200 && Array.isArray(rulesData.data), 'GET /api/salary-rules returns 200');
  assert(rulesData.data.length > 0, `Found ${rulesData.data.length} salary rules for structure ${matchedStruct.id}`);
  assert(
    rulesData.data.every(r => r.structureId === matchedStruct.id || r.salaryStructure?.id === matchedStruct.id),
    'All returned rules belong to the requested structure'
  );

  // 9. Payroll / Payrun History
  console.log('\n9. Testing Payroll / Payrun History...');
  const payrunsRes = await fetch(`${BASE_URL}/payroll/payruns`, { headers: authHeaders });
  const payrunsData = await payrunsRes.json();
  assert(payrunsRes.status === 200 && Array.isArray(payrunsData.data), 'GET /api/payroll/payruns returns 200');

  // 10. Error Handling: 401 Unauthorized
  console.log('\n10. Testing Error Handling (401 & 404)...');
  const unauthRes = await fetch(`${BASE_URL}/employees/${johnDoe.id}`);
  assert(unauthRes.status === 401, 'Unauthenticated GET /api/employees/:id returns 401');

  // 11. Error Handling: 404 Nonexistent Employee
  const notFoundRes = await fetch(`${BASE_URL}/employees/nonexistent-id-0000`, { headers: authHeaders });
  assert(notFoundRes.status === 404, 'Nonexistent employee ID returns 404');

  // 12. Employee Switching Integrity
  console.log('\n11. Testing Employee Switching Data Integrity...');
  const empBProfileRes = await fetch(`${BASE_URL}/employees/${empB.id}`, { headers: authHeaders });
  const empBProfile = (await empBProfileRes.json()).data;
  assert(empBProfile.id !== johnProfile.id, 'Employee A and B have distinct IDs');
  assert(empBProfile.name !== johnProfile.name, 'Employee A and B have distinct names');

  const empBContracts = contractsData.data.filter(
    c => c.employeeId === empB.id || (empB.activeContractId && c.id === empB.activeContractId) || c.employeeName === empB.name
  );
  assert(empBContracts.length > 0 && empBContracts[0].id === 'CON-002', `${empB.name} contract is distinct (CON-002)`);
  assert(empBContracts[0].id !== johnContracts[0].id, 'Contracts do NOT overlap between employees');

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
