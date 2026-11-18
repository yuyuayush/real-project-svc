import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/database.js';
import { userRepository } from '../repositories/user.repository.js';
import { Server } from 'http';

async function runAuthTests() {
  console.log('🧪 Starting Auth & MongoDB API Test Suite...');
  
  // 1. Connect DB and seed default users
  await connectDatabase();
  await userRepository.seedDefaultUsers();
  console.log(`🍃 Database status: ${isDatabaseConnected() ? 'Connected to MongoDB (Compass)' : 'In-Memory Fallback'}`);

  const app = createApp();
  const testPort = 5055;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(testPort, '127.0.0.1', () => resolve(s));
  });

  const baseUrl = `http://127.0.0.1:${testPort}/api/v1/auth`;

  try {
    // Test 1: Invalid email / validation schema check
    console.log('\n--- Test 1: Schema Validation (Invalid Email) ---');
    const invalidEmailRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '123' }),
    });
    const invalidEmailData = (await invalidEmailRes.json()) as any;
    console.log('Status:', invalidEmailRes.status, '(Expected 400)');
    console.log('Validation errors:', invalidEmailData.errors);
    if (invalidEmailRes.status !== 400 || !invalidEmailData.errors) {
      throw new Error('Test 1 Failed: Schema validation did not catch invalid inputs');
    }
    console.log('✅ Test 1 Passed: Schema validated directly via validateSchema');

    // Test 2: Invalid password check
    console.log('\n--- Test 2: Invalid Password ---');
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@payflow.io', password: 'wrongpassword' }),
    });
    const wrongPassData = (await wrongPassRes.json()) as any;
    console.log('Status:', wrongPassRes.status, '(Expected 401)');
    console.log('Message:', wrongPassData.message);
    if (wrongPassRes.status !== 401) {
      throw new Error('Test 2 Failed: Did not reject wrong credentials');
    }
    console.log('✅ Test 2 Passed: Rejected invalid credentials properly');

    // Test 3: Successful login with demo account
    console.log('\n--- Test 3: Successful Login & HTTP-Only Cookie ---');
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@payflow.io',
        password: 'password123',
        rememberMe: true,
      }),
    });
    const loginData = (await loginRes.json()) as any;
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('Status:', loginRes.status, '(Expected 200)');
    console.log('User logged in:', loginData.data?.user?.email);
    console.log('Cookie received:', setCookieHeader);
    
    if (loginRes.status !== 200 || !setCookieHeader || !setCookieHeader.includes('payflow_auth_token')) {
      throw new Error('Test 3 Failed: Cookie payflow_auth_token was not set in headers');
    }
    if (!setCookieHeader.includes('HttpOnly')) {
      throw new Error('Test 3 Failed: Cookie is missing HttpOnly attribute');
    }
    console.log('✅ Test 3 Passed: Successfully authenticated, received HTTP-only cookie and user profile');

    // Extract cookie value for subsequent requests
    const cookiePart = setCookieHeader.split(';')[0];

    // Test 4: Verify Session via /me using Cookie
    console.log('\n--- Test 4: Verify Session via GET /me using Cookie ---');
    const meRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: { Cookie: cookiePart },
    });
    const meData = (await meRes.json()) as any;
    console.log('Status:', meRes.status, '(Expected 200)');
    console.log('Current user:', meData.data?.user?.name, `(${meData.data?.user?.companyName})`);
    if (meRes.status !== 200 || meData.data?.user?.email !== 'demo@payflow.io') {
      throw new Error('Test 4 Failed: /me did not recognize cookie session');
    }
    console.log('✅ Test 4 Passed: Cookie session successfully authenticated');

    // Test 5: Verify MongoDB Compass User persistence
    console.log('\n--- Test 5: Check User in Repository / MongoDB Compass ---');
    const userInDb = await userRepository.findByEmail('demo@payflow.io');
    console.log('User in DB:', userInDb?.email, '| Role:', userInDb?.role, '| ID:', userInDb?.id);
    if (!userInDb) {
      throw new Error('Test 5 Failed: User was not found in persistence layer');
    }
    console.log('✅ Test 5 Passed: User verified in MongoDB Compass / persistent repository');

    // Test 6: Logout & Clear Cookie
    console.log('\n--- Test 6: Logout & Cookie Invalidation ---');
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { Cookie: cookiePart },
    });
    const logoutCookie = logoutRes.headers.get('set-cookie');
    console.log('Status:', logoutRes.status, '(Expected 200)');
    console.log('Logout cookie cleared:', logoutCookie);
    if (logoutRes.status !== 200 || !logoutCookie || !logoutCookie.includes('payflow_auth_token=;')) {
      throw new Error('Test 6 Failed: Logout did not clear cookie');
    }
    console.log('✅ Test 6 Passed: Logout cleared cookie successfully');

    console.log('\n🎉 ALL AUTH & PERSISTENCE TESTS PASSED CLEANLY!\n');
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

runAuthTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
