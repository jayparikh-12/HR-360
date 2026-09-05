import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'peoplepay360',
  port: parseInt(process.env.DB_PORT || '3306', 10),
});

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Phase 5.3 Live End-to-End API Verification ---');

  // 1. Authenticate as HR Admin (Elena Vance)
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'elena@company.com', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data?.token || loginData.token;
  console.log('✓ 1. Logged in as Elena Vance (ADMIN/HR Manager)');

  // 2. Create a new Payrun in DRAFT
  const createRes = await fetch(`${BASE_URL}/payroll/payruns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      pay_date: '2026-11-01',
      notes: 'Phase 5.3 Validation Test Payrun'
    })
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Payrun creation failed: ${JSON.stringify(createData)}`);
  }
  const payrun = createData.data || createData;
  const payrunId = payrun.id;
  console.log(`✓ 2. Created Payrun ${payrunId} in DRAFT status`);

  // 3. Attempt to VALIDATE directly from DRAFT (Must fail with 400)
  const validateDraftRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/validate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const validateDraftData = await validateDraftRes.json();
  if (validateDraftRes.status === 400) {
    console.log(`✓ 3. Validation on DRAFT payrun correctly rejected (HTTP 400): ${validateDraftData.message}`);
  } else {
    throw new Error(`Expected 400 on DRAFT validation, got ${validateDraftRes.status}: ${JSON.stringify(validateDraftData)}`);
  }

  // 4. COMPUTE the Payrun (Phase 5.2 workflow)
  const computeRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/compute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const computeData = await computeRes.json();
  if (!computeRes.ok) {
    throw new Error(`Compute failed: ${JSON.stringify(computeData)}`);
  }
  console.log(`✓ 4. Successfully computed Payrun ${payrunId}: status=${computeData.data.payrun.status}, employeeCount=${computeData.data.computedCount}`);

  // Query snapshot values before validation to ensure they do not change
  const [beforeRows] = await pool.query('SELECT gross_salary, total_deductions, net_salary FROM payslips WHERE payrun_id = ?', [payrunId]);
  console.log(`✓ Stored snapshots before validation: ${beforeRows.length} payslips`);

  // 5. VALIDATE the COMPUTED Payrun
  const validateRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/validate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const validateData = await validateRes.json();
  if (!validateRes.ok) {
    throw new Error(`Validation failed: ${JSON.stringify(validateData)}`);
  }
  console.log(`✓ 5. Successfully validated Payrun ${payrunId}:`, {
    status: validateData.data.status,
    validated_by: validateData.data.validated_by,
    validated_at: validateData.data.validated_at
  });

  // Verify DB state
  const [payrunDbRows] = await pool.query('SELECT status, validated_by, validated_at FROM payruns WHERE id = ?', [payrunId]);
  if (payrunDbRows[0].status !== 'VALIDATED' || !payrunDbRows[0].validated_by || !payrunDbRows[0].validated_at) {
    throw new Error(`Database record does not match expected VALIDATED state: ${JSON.stringify(payrunDbRows[0])}`);
  }
  console.log('✓ Verified payrun in DB: status=VALIDATED, validated_by=' + payrunDbRows[0].validated_by);

  // Verify all payslips in DB are VALIDATED
  const [afterRows] = await pool.query('SELECT status, gross_salary, total_deductions, net_salary FROM payslips WHERE payrun_id = ?', [payrunId]);
  for (let i = 0; i < afterRows.length; i++) {
    if (afterRows[i].status !== 'VALIDATED') {
      throw new Error(`Payslip ${i} is not VALIDATED: ${afterRows[i].status}`);
    }
    if (Number(afterRows[i].gross_salary) !== Number(beforeRows[i].gross_salary) ||
        Number(afterRows[i].total_deductions) !== Number(beforeRows[i].total_deductions) ||
        Number(afterRows[i].net_salary) !== Number(beforeRows[i].net_salary)) {
      throw new Error(`Payslip ${i} calculation changed during validation!`);
    }
  }
  console.log('✓ Verified all payslips status=VALIDATED and calculation amounts remained strictly unchanged');

  // 6. Attempt repeat validation (Idempotency / Repeat request handling)
  const repeatValidateRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/validate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const repeatValidateData = await repeatValidateRes.json();
  if (repeatValidateRes.status === 400) {
    console.log(`✓ 6. Repeat validation safely rejected (HTTP 400): ${repeatValidateData.message}`);
  } else {
    throw new Error(`Expected 400 on duplicate validation, got ${repeatValidateRes.status}`);
  }

  // 7. Attempt re-compute on VALIDATED Payrun (Snapshot protection)
  const recomputeRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/compute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const recomputeData = await recomputeRes.json();
  if (recomputeRes.status === 400) {
    console.log(`✓ 7. Re-compute on VALIDATED payrun blocked (HTTP 400): ${recomputeData.message}`);
  } else {
    throw new Error(`Expected 400 on recomputing VALIDATED payrun, got ${recomputeRes.status}`);
  }

  // 8. Test unauthorized / forbidden access
  // Unauthenticated
  const unauthRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/validate`, {
    method: 'POST'
  });
  if (unauthRes.status === 401) {
    console.log('✓ 8. Unauthenticated validation rejected (HTTP 401)');
  } else {
    throw new Error(`Expected 401, got ${unauthRes.status}`);
  }

  // Employee role (Bob Martinez - Employee)
  const bobLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bob@company.com', password: 'password123' })
  });
  const bobData = await bobLogin.json();
  const bobToken = bobData.data?.token || bobData.token;

  const forbiddenRes = await fetch(`${BASE_URL}/payroll/payruns/${payrunId}/validate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bobToken}` }
  });
  if (forbiddenRes.status === 403) {
    console.log('✓ 9. Forbidden employee validation rejected (HTTP 403)');
  } else {
    throw new Error(`Expected 403, got ${forbiddenRes.status}`);
  }

  console.log('\n--- ALL LIVE E2E VALIDATION CHECKS PASSED SUCCESSFULLY ---');
  await pool.end();
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
