/**
 * PeoplePay360 — Phase 3 Payrun Validation & Payment Action Verification Script
 */

import { executeQuery } from '../server/dist/config/database.js';

const BASE_URL = 'http://localhost:5000';

async function main() {
  console.log('=== Step 1: Testing Unauthenticated Access ===');
  const unauthValRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/validate`, {
    method: 'PATCH',
  });
  console.log(`Unauthenticated validate status: ${unauthValRes.status} (Expected: 401)`);
  if (unauthValRes.status !== 401) throw new Error('Unauthenticated validate did not return 401');

  const unauthPayRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/pay`, {
    method: 'PATCH',
  });
  console.log(`Unauthenticated pay status: ${unauthPayRes.status} (Expected: 401)`);
  if (unauthPayRes.status !== 401) throw new Error('Unauthenticated pay did not return 401');

  console.log('\n=== Step 2: Authenticating as Admin ===');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'elena@company.com', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  const token = loginData.token;
  console.log('Successfully obtained JWT token.');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log('\n=== Step 3: Ensuring Test Payrun is in DRAFT Status ===');
  await executeQuery("UPDATE payruns SET status = 'DRAFT' WHERE id = 'PR-2026-09'");

  const getDraftRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09`, {
    headers: authHeaders,
  });
  const draftData = await getDraftRes.json();
  console.log(`Current status: ${draftData.data.status} (Expected: DRAFT)`);
  if (draftData.data.status !== 'DRAFT') throw new Error('Payrun not in DRAFT');

  console.log('\n=== Step 4: Invalid Transition — Paying a DRAFT Payrun ===');
  const invalidPayRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/pay`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  const invalidPayData = await invalidPayRes.json();
  console.log(`Status: ${invalidPayRes.status} (Expected: 400), Message: "${invalidPayData.message}"`);
  if (invalidPayRes.status !== 400) throw new Error('Paying DRAFT should return 400');

  console.log('\n=== Step 5: Validating the Payrun (PATCH /validate) ===');
  const validateRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/validate`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  const validateData = await validateRes.json();
  console.log(`Status: ${validateRes.status} (Expected: 200), Updated Status: "${validateData.data?.status}"`);
  if (validateRes.status !== 200 || validateData.data?.status !== 'VALIDATED') {
    throw new Error('Validate failed');
  }

  console.log('\n=== Step 6: Verifying Persistence in MySQL ===');
  const [rowsValidated] = await executeQuery("SELECT status FROM payruns WHERE id = 'PR-2026-09'");
  console.log(`Database status: ${rowsValidated.status} (Expected: VALIDATED)`);
  if (rowsValidated.status !== 'VALIDATED') throw new Error('Validation was not persisted in DB');

  console.log('\n=== Step 7: Invalid Transition — Validating an already VALIDATED Payrun ===');
  const doubleValidateRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/validate`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  const doubleValidateData = await doubleValidateRes.json();
  console.log(`Status: ${doubleValidateRes.status} (Expected: 400), Message: "${doubleValidateData.message}"`);
  if (doubleValidateRes.status !== 400) throw new Error('Double validate should return 400');

  console.log('\n=== Step 8: Paying the Payrun (PATCH /pay) ===');
  const payRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/pay`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  const payData = await payRes.json();
  console.log(`Status: ${payRes.status} (Expected: 200), Updated Status: "${payData.data?.status}"`);
  if (payRes.status !== 200 || payData.data?.status !== 'PAID') {
    throw new Error('Payment failed');
  }

  console.log('\n=== Step 9: Verifying Persistence in MySQL ===');
  const [rowsPaid] = await executeQuery("SELECT status FROM payruns WHERE id = 'PR-2026-09'");
  console.log(`Database status: ${rowsPaid.status} (Expected: PAID)`);
  if (rowsPaid.status !== 'PAID') throw new Error('Payment was not persisted in DB');

  console.log('\n=== Step 10: Invalid Transition — Paying an already PAID Payrun ===');
  const doublePayRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/pay`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  const doublePayData = await doublePayRes.json();
  console.log(`Status: ${doublePayRes.status} (Expected: 400), Message: "${doublePayData.message}"`);
  if (doublePayRes.status !== 400) throw new Error('Double pay should return 400');

  console.log('\n=== Step 11: Invalid Transition — Validating a PAID Payrun ===');
  const valPaidRes = await fetch(`${BASE_URL}/api/payroll/payruns/PR-2026-09/validate`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  const valPaidData = await valPaidRes.json();
  console.log(`Status: ${valPaidRes.status} (Expected: 400), Message: "${valPaidData.message}"`);
  if (valPaidRes.status !== 400) throw new Error('Validating PAID payrun should return 400');

  console.log('\n=== Step 12: Resetting record to DRAFT for UI manual/browser testing ===');
  await executeQuery("UPDATE payruns SET status = 'DRAFT' WHERE id = 'PR-2026-09'");
  const [rowsReset] = await executeQuery("SELECT status FROM payruns WHERE id = 'PR-2026-09'");
  console.log(`Reset status: ${rowsReset.status} (Ready for UI test)`);

  console.log('\n>>> ALL BACKEND WORKFLOW & PERSISTENCE TESTS PASSED! <<<');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
