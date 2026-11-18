import { AuthController, AUTH_COOKIE_NAME } from '../controllers/auth.controller.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../errors/app-error.js';
import { Request, Response } from 'express';

// Helper to create mock Express Request and Response objects
function createMockReqRes(options: {
  body?: unknown;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  let statusCode = 200;
  let responseData: any = null;
  const cookiesSet: Record<string, { val: string; options: any }> = {};
  const cookiesCleared: string[] = [];

  const req = {
    body: options.body || {},
    cookies: options.cookies || {},
    headers: options.headers || {},
  } as unknown as Request;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    cookie(name: string, val: string, options: any) {
      cookiesSet[name] = { val, options };
      return this;
    },
    clearCookie(name: string, options: any) {
      cookiesCleared.push(name);
      return this;
    },
  } as unknown as Response;

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getCookiesSet: () => cookiesSet,
    getCookiesCleared: () => cookiesCleared,
  };
}

async function runDirectAuthTests() {
  console.log('🧪 Starting Direct In-Process Auth & Schema Validation Test Suite...');

  // 1. Seed users
  await userRepository.seedDefaultUsers();
  console.log('✅ Default users seeded successfully.');

  // Verify users in repository
  const demoUser = await userRepository.findByEmail('demo@payflow.io');
  if (!demoUser || !demoUser.passwordHash) {
    throw new Error('❌ Demo user seeding verification failed');
  }
  console.log(`✅ Demo user present in repository: ${demoUser.email} (Role: ${demoUser.role})`);

  // Test 1: Invalid email / schema validation check
  console.log('\n--- Test 1: Schema Validation (Bad Email & Short Password) ---');
  const test1 = createMockReqRes({
    body: { email: 'invalid-email', password: '12' },
  });
  let test1Error: any = null;
  try {
    await (AuthController.login as any)(test1.req, test1.res, (err: any) => {
      test1Error = err;
    });
  } catch (err) {
    test1Error = err;
  }
  if (!test1Error || test1Error.statusCode !== 400 || !test1Error.details) {
    throw new Error(`Test 1 Failed: Expected BadRequestError with validation errors, got ${test1Error}`);
  }
  console.log('✅ Test 1 Passed: validateSchema threw BadRequestError with validation details:');
  console.log('   Errors caught:', test1Error.details);

  // Test 2: Invalid Password
  console.log('\n--- Test 2: Invalid Password ---');
  const test2 = createMockReqRes({
    body: { email: 'demo@payflow.io', password: 'wrongpassword' },
  });
  let test2Error: any = null;
  await new Promise<void>((resolve) => {
    (AuthController.login as any)(test2.req, test2.res, (err: any) => {
      test2Error = err;
      resolve();
    });
  });
  if (!test2Error || test2Error.statusCode !== 401) {
    throw new Error(`Test 2 Failed: Expected 401 Unauthorized, got ${test2Error}`);
  }
  console.log(`✅ Test 2 Passed: Rejected invalid credentials (${test2Error.message})`);

  // Test 3: Successful Login & HTTP-Only Cookie Setting
  console.log('\n--- Test 3: Successful Login & HTTP-Only Cookie ---');
  const test3 = createMockReqRes({
    body: { email: 'demo@payflow.io', password: 'password123', rememberMe: true },
  });
  await new Promise<void>((resolve, reject) => {
    (AuthController.login as any)(test3.req, test3.res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
    // In successful handler, res.json is called, which marks completion
    setTimeout(resolve, 50);
  });

  const statusCode = test3.getStatusCode();
  const data = test3.getData();
  const cookies = test3.getCookiesSet();

  console.log('Status code:', statusCode, '(Expected 200)');
  console.log('User returned:', data?.data?.user?.email);
  console.log('Cookie set:', cookies[AUTH_COOKIE_NAME]);

  if (statusCode !== 200 || !data?.data?.token) {
    throw new Error('Test 3 Failed: Login did not return 200 with token');
  }
  if (!cookies[AUTH_COOKIE_NAME] || !cookies[AUTH_COOKIE_NAME].options.httpOnly) {
    throw new Error('Test 3 Failed: Cookie payflow_auth_token was not set with httpOnly: true');
  }
  console.log('✅ Test 3 Passed: User authenticated, returned profile and HTTP-only cookie set');

  const authToken = cookies[AUTH_COOKIE_NAME].val;

  // Test 4: Profile lookup via GET /me using Cookie
  console.log('\n--- Test 4: Profile lookup via GET /me using Cookie ---');
  const test4 = createMockReqRes({
    cookies: { [AUTH_COOKIE_NAME]: authToken },
  });
  await new Promise<void>((resolve, reject) => {
    (AuthController.me as any)(test4.req, test4.res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
    setTimeout(resolve, 50);
  });

  console.log('Status code:', test4.getStatusCode(), '(Expected 200)');
  console.log('Profile from /me:', test4.getData()?.data?.user?.name, `(${test4.getData()?.data?.user?.role})`);
  if (test4.getStatusCode() !== 200 || test4.getData()?.data?.user?.email !== 'demo@payflow.io') {
    throw new Error('Test 4 Failed: Could not resolve user from auth cookie');
  }
  console.log('✅ Test 4 Passed: Cookie verified, user profile returned');

  // Test 5: Logout & Cookie Clearing
  console.log('\n--- Test 5: Logout & Cookie Invalidation ---');
  const test5 = createMockReqRes({
    cookies: { [AUTH_COOKIE_NAME]: authToken },
  });
  await new Promise<void>((resolve, reject) => {
    (AuthController.logout as any)(test5.req, test5.res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
    setTimeout(resolve, 50);
  });

  const cleared = test5.getCookiesCleared();
  console.log('Status code:', test5.getStatusCode(), '(Expected 200)');
  console.log('Cookies cleared:', cleared);
  if (!cleared.includes(AUTH_COOKIE_NAME)) {
    throw new Error('Test 5 Failed: Cookie was not cleared during logout');
  }
  console.log('✅ Test 5 Passed: Logout successfully invalidated session and cleared HTTP-only cookie');

  console.log('\n🎉 ALL CONTROLLER, REPOSITORY & COOKIE TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runDirectAuthTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
