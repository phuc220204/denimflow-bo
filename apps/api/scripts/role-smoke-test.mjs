// Role smoke test: logs in as each seeded demo account against a running API and checks that
// every role gets the expected status codes. Needs the API running (`pnpm dev`) with Supabase
// configured and the seed applied. Run: pnpm --filter @denimflow/api smoke:roles
// Password: DEMO_PASSWORD from the shell if set, otherwise SEED_DEFAULT_PASSWORD from apps/api/.env.
// Prints only HTTP status codes. It never prints tokens or passwords and writes no data
// (the "create template" probe sends an empty name: allowed role -> 422, others -> 403).
const API = process.env.API_URL ?? 'http://localhost:3000';
const password = process.env.DEMO_PASSWORD ?? process.env.SEED_DEFAULT_PASSWORD;
if (!password) {
  console.error('Set DEMO_PASSWORD (or SEED_DEFAULT_PASSWORD in apps/api/.env).');
  process.exit(1);
}

const domain = process.env.DEMO_DOMAIN ?? 'denimflow.internal';
const accounts = [
  ['ADMIN', 'admin'],
  ['PROCESS_ENGINEER', 'pe'],
  ['PRODUCTION_PLANNER', 'planner'],
  ['WAREHOUSE_KEEPER', 'warehouse'],
  ['STATION_OPERATOR', 'operator'],
  ['QC_INSPECTOR', 'qc'],
  ['MANAGER', 'manager'],
];

// [label, method, path, body, expected status per role (default if role missing)]
const probes = [
  ['GET /auth/me', 'GET', '/auth/me', undefined, { default: 200 }],
  ['GET /catalog/stations', 'GET', '/catalog/stations', undefined, { default: 200 }],
  ['GET /workflow/templates', 'GET', '/workflow/templates', undefined, { default: 200 }],
  [
    'POST /workflow/templates (empty)',
    'POST',
    '/workflow/templates',
    { name: '' },
    { PROCESS_ENGINEER: 422, default: 403 },
  ],
  ['GET /users', 'GET', '/users', undefined, { ADMIN: 200, default: 403 }],
  ['GET /orders', 'GET', '/orders', undefined, { default: 200 }],
];

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Some responses (e.g. 204) have no JSON body; treat them as null.
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

let failures = 0;
for (const [role, prefix] of accounts) {
  const email = `${prefix}@${domain}`;
  const login = await call('POST', '/auth/login', undefined, { email, password });
  // NestJS answers POST with 201 by default, so any 2xx with a token counts as a successful login.
  if (login.status < 200 || login.status > 299 || !login.json?.accessToken) {
    console.log(
      `\n${role.padEnd(20)} login ${login.status}  (${login.json?.message ?? 'no message'})`,
    );
    failures++;
    continue;
  }
  const token = login.json.accessToken;
  const roleOk = login.json.user?.role === role;
  console.log(
    `\n${role.padEnd(20)} login ${login.status}, role from profile = ${login.json.user?.role} ${roleOk ? 'OK' : 'MISMATCH'}`,
  );
  if (!roleOk) failures++;
  for (const [label, method, path, body, expect] of probes) {
    const { status } = await call(method, path, token, body);
    const expected = expect[role] ?? expect.default;
    const ok = status === expected;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(34)} got ${status}, expected ${expected}`,
    );
  }
}
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} check(s) failed`}`);
