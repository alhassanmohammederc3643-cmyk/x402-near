// Exactly-once across a crash: settle a payment, kill -9 the facilitator mid-run,
// restart it on the same store, and confirm the same payment is still rejected.
// Uses a stub relayer (no keys, no broadcast); verify() runs for real, including the
// signature check and the live testnet block-height expiry check. Run: node crash-test.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import { fakeAccount } from './test-helpers.mjs';
import { nearApi } from './lib.mjs';

const PORT = 4491, STORE = '/tmp/crash-test-store-' + Date.now() + '.jsonl';
const buyer = fakeAccount('buyer-crash.testnet');
let nonce = 1n;
const mkPayload = async () => {
  nonce += 1n; // each payment gets its own nonce, so payloads differ (ed25519 signing is deterministic)
  const [, sd] = await buyer.createSignedMetaTransaction('wrap.testnet', [nearApi.transactions.functionCall('ft_transfer', { receiver_id: 'seller-crash.testnet', amount: '10000000000000000000000' }, 30000000000000n, 1n)]);
  return Buffer.from((await import('@near-js/transactions')).encodeSignedDelegate(sd)).toString('base64');
};
const requirements = { network: 'near-testnet', asset: 'wrap.testnet', payTo: 'seller-crash.testnet', payer: 'buyer-crash.testnet', maxAmountRequired: '10000000000000000000000' };
const settle = (payload) => fetch(`http://localhost:${PORT}/settle`, { method: 'POST', body: JSON.stringify({ requirements, payload }) }).then((r) => r.json());
const start = () => {
  const p = spawn('node', ['crash-child.mjs', String(PORT), STORE], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res) => p.stdout.on('data', function h(d) { if (String(d).includes('ready')) { p.stdout.off('data', h); res(p); } }));
};
let bad = 0; const t = (n, ok) => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n); };

const payload = await mkPayload();
let child = await start();
const first = await settle(payload);
t('first settle succeeds', first.success === true);
const again = await settle(payload);
t('immediate replay rejected', again.success === false && again.reason === 'replay');
child.kill(9); // hard crash, no graceful shutdown
await new Promise((r) => child.on('exit', r));
child = await start(); // restart on the same store file
const afterCrash = await settle(payload);
t('same payment still rejected after kill -9 and restart', afterCrash.success === false && afterCrash.reason === 'replay');
const other = await settle(await mkPayload()); // a different payment (new signature) still settles
t('a different payment still settles after restart', other.success === true);
child.kill(9);
fs.unlinkSync(STORE);
process.exit(bad ? 1 : 0);
