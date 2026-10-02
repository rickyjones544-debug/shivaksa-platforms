import crypto from 'crypto';
import fs from 'fs';
import pg from 'pg';

const ENV_PATH = process.env.ENV_PATH || '/opt/shivaksa-platform/.env.local';
const USERNAME = process.env.SIP_USERNAME || 'shv_7b829bcb3ff0';
const CALLER_ID = process.env.SIP_CALLER_ID || '+442070000000';
const CREDIT = process.env.SIP_TEST_CREDIT || '10';

function env(name) {
  const line = fs
    .readFileSync(ENV_PATH, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^["']|["']$/g, '') : null;
}

const password = crypto.randomBytes(24).toString('base64url').slice(0, 24);
const key = crypto.createHash('sha256').update(env('ENCRYPTION_KEY')).digest();
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);

const client = new pg.Client({
  connectionString: env('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const acc = await client.query(
  `UPDATE sip_accounts
     SET password_cipher=$1, password_tag=$2, password_iv=$3,
         caller_id=$4, status='ACTIVE', provisioning_state='PENDING',
         provisioning_error=NULL, updated_at=now()
   WHERE username=$5
   RETURNING id, status, provisioning_state, max_concurrent_calls`,
  [encrypted.toString('hex'), cipher.getAuthTag().toString('hex'), iv.toString('hex'), CALLER_ID, USERNAME],
);
if (acc.rowCount === 0) {
  console.log('SIP_ACCOUNT_NOT_FOUND');
  process.exit(1);
}
const sipAccountId = acc.rows[0].id;
const maxConcurrentCalls = acc.rows[0].max_concurrent_calls;
const realm = env('ASTERISK_AUTH_REALM') || 'asterisk';
const md5Cred = crypto.createHash('md5').update(`${USERNAME}:${realm}:${password}`).digest('hex');

await client.query(
  `UPDATE wallets SET balance = balance + $1::numeric, updated_at = now()
   WHERE organization_id = (SELECT organization_id FROM sip_accounts WHERE id = $2)`,
  [CREDIT, sipAccountId],
);

await client.query(
  `INSERT INTO provisioning_tasks
     (id, action, status, payload, sip_account_id, attempts, created_at, updated_at)
   VALUES (gen_random_uuid(), 'UPSERT_ENDPOINT', 'PENDING', $2, $1, 0, now(), now())`,
  [sipAccountId, JSON.stringify({ username: USERNAME, md5Cred, maxConcurrentCalls })],
);

fs.writeFileSync(
  '/tmp/sip_test_credentials.json',
  JSON.stringify({ username: USERNAME, password, sipAccountId }),
);
console.log('SIP_ACCOUNT_RESET_OK', sipAccountId);
await client.end();
