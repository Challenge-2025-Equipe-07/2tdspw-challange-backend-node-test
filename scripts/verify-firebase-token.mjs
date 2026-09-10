import { readFileSync } from 'node:fs';
import { createVerify } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const token = process.argv[2];
if (!token) {
  console.error('Usage: node scripts/verify-firebase-token.mjs <idToken> [serviceAccount.json]');
  process.exit(1);
}

const [h, p, s] = token.split('.');
const header = JSON.parse(Buffer.from(h, 'base64url').toString());
const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
console.log('claims', {
  kid: header.kid,
  aud: payload.aud,
  iss: payload.iss,
  uid: payload.user_id,
  exp: new Date(payload.exp * 1000).toISOString(),
  expired: Date.now() / 1000 > payload.exp,
});

const certsRes = await fetch(
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
);
const certs = await certsRes.json();
const pem = certs[header.kid];
console.log('googleCert', pem ? 'found' : 'missing');
if (pem) {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${h}.${p}`);
  console.log('signatureValid', verifier.verify(pem, Buffer.from(s, 'base64url')));
}

const saPath = process.argv[3];
const projectId = payload.aud;
if (!getApps().length) {
  if (saPath) {
    const sa = JSON.parse(readFileSync(saPath, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
    console.log('adminInit', 'service-account', sa.project_id);
  } else {
    initializeApp({ projectId });
    console.log('adminInit', 'projectId-only', projectId);
  }
}

try {
  const decoded = await getAuth().verifyIdToken(token);
  console.log('verifyIdToken OK', decoded.uid);
} catch (error) {
  console.log('verifyIdToken FAIL', {
    code: error.code,
    message: error.message,
  });
  process.exitCode = 1;
}
