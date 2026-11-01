// Policy tests with a stub seller and stub facilitator: no chain calls, nothing signed on a deny. Run: node policy-test.mjs
import http from 'http';
import { PolicyBuyer } from './buyer.mjs';
import { fakeAccount } from './test-helpers.mjs';
const seller = 'seller-policy.testnet'; // hermetic: no keys, no chain
const stub = http.createServer((rq, rs) => {
  if (rq.headers['x-payment']) { rs.writeHead(200, { 'content-type': 'application/json' }); return rs.end(JSON.stringify({ paid: { transaction: 'stub' } })); }
  const price = rq.url === '/big' ? '500000000000000000000000' : '20000000000000000000000';
  rs.writeHead(402, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ accepts: [{ network: 'near-testnet', asset: 'wrap.testnet', payTo: seller, maxAmountRequired: price }] }));
}).listen(4499);
const b = new PolicyBuyer({ perCall: '0.05', budget: '1', allow: [seller], perPayee: { [seller]: '0.04' }, acct: fakeAccount('buyer-policy.testnet') });
let bad = 0; const t = (n, ok) => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n); };
t('first 0.02 paid', (await b.get('http://localhost:4499/a')).status === 200);
t('second 0.02 paid (at payee limit)', (await b.get('http://localhost:4499/a')).status === 200);
t('third blocked by per-payee limit', (await b.get('http://localhost:4499/a')).reason === 'per-payee limit reached');
const c = new PolicyBuyer({ perCall: '0.05', budget: '1', allow: [seller], acct: fakeAccount('buyer-policy.testnet') });
t('over per-call cap blocked', (await c.get('http://localhost:4499/big')).reason === 'over per-call cap');
c.kill();
t('kill switch blocks everything', (await c.get('http://localhost:4499/a')).reason === 'kill switch engaged');
stub.close(); process.exit(bad ? 1 : 0);
