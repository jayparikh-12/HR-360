import jwt from '../server/node_modules/jsonwebtoken/index.js';

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = 'peoplepay360-hackathon-jwt-secret-2026';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🔒 SESSION TIMEOUT SECURITY & JWT EXPIRATION VERIFICATION 🔒');
  console.log('================================================================\n');

  // 1. Test Login & 20-Minute Expiration Claim
  console.log('--- 1. Login & Token Expiration Lifespan (20 Minutes) ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, `Login response status is 200 (received ${loginRes.status})`);
  assert(loginData.success === true, 'Login returned success: true');
  assert(typeof loginData.token === 'string', 'Token is a valid string');

  // Decode JWT payload
  const decoded = jwt.decode(loginData.token);
  assert(decoded !== null && typeof decoded === 'object', 'Token successfully decoded');
  assert(typeof decoded.exp === 'number', `Token has numeric exp claim: ${decoded.exp}`);
  assert(typeof decoded.iat === 'number', `Token has numeric iat claim: ${decoded.iat}`);

  const lifespanSeconds = decoded.exp - decoded.iat;
  console.log(`  ℹ Token lifespan: ${lifespanSeconds} seconds (${lifespanSeconds / 60} minutes)`);
  assert(lifespanSeconds === 1200, `Token lifespan is exactly 1200 seconds (20 minutes), found: ${lifespanSeconds}`);

  // 2. Protected API Access with Fresh Token
  console.log('\n--- 2. Protected API Access with Fresh Token ---');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const meData = await meRes.json();
  assert(meRes.status === 200, `GET /api/auth/me with fresh token returns 200 (received ${meRes.status})`);
  assert(meData.success === true, 'GET /api/auth/me returned success: true');
  assert(meData.user?.email === 'admin@company.com', 'User email correctly matched');

  // 3. Expired Token Rejection
  console.log('\n--- 3. Expired Token Enforcement (HTTP 401 Rejection) ---');
  // Generate an artificially expired token (expired 60 seconds ago)
  const expiredPayload = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    iat: Math.floor(Date.now() / 1000) - 3600,
    exp: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
  };
  const expiredToken = jwt.sign(expiredPayload, JWT_SECRET);

  const expiredRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  const expiredData = await expiredRes.json();
  assert(expiredRes.status === 401, `GET /api/auth/me with expired token returns 401 Unauthorized (received ${expiredRes.status})`);
  assert(expiredData.success === false, 'Expired token response returned success: false');
  assert(expiredData.message === 'Unauthorized', 'Error message is generic "Unauthorized" without leaking internal verify details');
  assert(expiredData.user === undefined, 'No protected user data returned with expired token');

  // 4. Bad Credentials vs Session Expiration (401 Disambiguation)
  console.log('\n--- 4. Unauthenticated Login Failure (401 Disambiguation) ---');
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'wrongpassword' }),
  });
  const badLoginData = await badLoginRes.json();
  assert(badLoginRes.status === 401, `Invalid login credentials returns 401 (received ${badLoginRes.status})`);
  assert(badLoginData.message === 'Invalid email or password', 'Correctly preserves specific credentials failure message');

  // 5. Frontend JWT Utility Logic Simulation
  console.log('\n--- 5. Frontend JWT Parser & Expiration Logic Simulation ---');
  function simulateParseJwt(t) {
    try {
      if (!t || typeof t !== 'string') return null;
      const parts = t.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padLength = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLength);
      return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  function simulateIsTokenExpired(t) {
    const p = simulateParseJwt(t);
    if (!p || typeof p.exp !== 'number') return true;
    return Date.now() >= p.exp * 1000;
  }

  function simulateGetTokenRemainingMs(t) {
    const p = simulateParseJwt(t);
    if (!p || typeof p.exp !== 'number') return 0;
    return Math.max(0, p.exp * 1000 - Date.now());
  }

  assert(simulateIsTokenExpired(loginData.token) === false, 'Fresh 20-minute token is NOT expired');
  assert(simulateIsTokenExpired(expiredToken) === true, 'Expired token IS expired');
  assert(simulateIsTokenExpired('invalid.token') === true, 'Malformed token is treated as expired');
  assert(simulateIsTokenExpired(null) === true, 'Null token is treated as expired');

  const remainingMs = simulateGetTokenRemainingMs(loginData.token);
  console.log(`  ℹ Remaining lifetime for fresh token: ${Math.round(remainingMs / 1000)} seconds`);
  assert(remainingMs > 1150 * 1000 && remainingMs <= 1200 * 1000, `Remaining ms (~${Math.round(remainingMs / 1000)}s) is consistent with 20m window`);
  assert(simulateGetTokenRemainingMs(expiredToken) === 0, 'Remaining ms for expired token is 0');

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
