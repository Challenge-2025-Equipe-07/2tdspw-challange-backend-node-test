// Temporary smoke test for the Azure Web App.
// Usage:
//   node scripts/smoke-deployed-api.mjs
//   node scripts/smoke-deployed-api.mjs <firebase-id-token>

const base = (
  process.env.API_BASE_URL ?? 'https://veti-api-nyhmyyhlqmwgk.azurewebsites.net'
).replace(/\/$/, '');
const token = process.argv[2] ?? process.env.FIREBASE_ID_TOKEN;

const failures = [];

async function call(method, path, { auth = false, body } = {}) {
  const headers = { accept: 'application/json' };
  if (auth) {
    if (!token) {
      throw new Error(`No token for ${method} ${path}`);
    }
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

function expect(name, condition, detail) {
  if (condition) {
    console.log(`ok  ${name}`);
    return;
  }
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  failures.push(name);
}

const hello = await call('GET', '/');
expect(
  'GET / is public',
  hello.status === 200 && hello.text.includes('Hello World'),
  `status ${hello.status} body ${hello.text.slice(0, 120)}`,
);

for (const path of ['/me', '/owner', '/products', '/notifications?page=1', '/dashboard']) {
  const result = await call('GET', path);
  expect(
    `GET ${path} without a token is 401`,
    result.status === 401,
    `status ${result.status} body ${result.text.slice(0, 160)}`,
  );
}

if (!token) {
  console.log('skip authenticated calls (pass a Firebase ID token to run them)');
} else {
  const me = await call('GET', '/me', { auth: true });
  expect(
    'GET /me with token',
    me.status === 200 && typeof me.json?.id === 'string',
    `status ${me.status} body ${me.text.slice(0, 160)}`,
  );

  const products = await call('GET', '/products', { auth: true });
  expect(
    'GET /products with token',
    products.status === 200 && Array.isArray(products.json),
    `status ${products.status} body ${products.text.slice(0, 160)}`,
  );

  const owners = await call('GET', '/owner', { auth: true });
  expect(
    'GET /owner with token',
    owners.status === 200 && Array.isArray(owners.json),
    `status ${owners.status} body ${owners.text.slice(0, 160)}`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\npassed');
