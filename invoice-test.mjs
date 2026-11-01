// Invoice flow tests with a stub facilitator: no keys, no chain, nothing signed on a deny.
// Run: node invoice-test.mjs
import http from 'http';
import { startInvoices } from './invoices.mjs';
import { PolicyBuyer } from './buyer.mjs';
import { fakeAccount } from './test-helpers.mjs';
const sellerId = 'seller-invoices.testnet';
const stubFac = http.createServer((rq, rs) => {
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ success: true, transaction: 'stub-tx-' + Math.random().toString(36).slice(2, 8) }));
}).listen(4492);
const { srv } = await startInvoices({ port: 4493, facilitator: 'http://localhost:4492', payee: sellerId });
const post = (p, b) => fetch('http://localhost:4493' + p, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
const small = await post('/invoices', { amount: '0.02', memo: 'design work (simulated)' });
const small2 = await post('/invoices', { amount: '0.03', memo: 'hosting, one month (simulated)' });
const big = await post('/invoices', { amount: '0.5', memo: 'consulting, over budget (simulated)' });
const rogue = await post('/invoices', { amount: '0.01', memo: 'vendor with a different payee (simulated)', payee: 'someone-else.testnet' });
const buyer = new PolicyBuyer({ perCall: '0.05', budget: '1', allow: [sellerId], acct: fakeAccount('buyer-ap.testnet') });
let bad = 0; const t = (n, ok) => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n); };
const pay = (inv) => buyer.get(`http://localhost:4493/invoices/${inv.id}/pay`);
t('invoice 1 paid', (await pay(small)).status === 200);
t('invoice 2 paid', (await pay(small2)).status === 200);
t('over-cap invoice blocked by policy', (await pay(big)).reason === 'over per-call cap');
t('unknown payee blocked by policy', (await pay(rogue)).reason === 'payee/asset not allowed');
const again = await fetch(`http://localhost:4493/invoices/${small.id}/pay`, { headers: { 'x-payer': 'buyer-ap.testnet', 'x-payment': buyer.last } });
t('settled invoice rejects a second payment', again.status === 409);
const list = await fetch('http://localhost:4493/invoices').then((r) => r.json());
t('ledger shows 2 paid and 2 unpaid', list.filter((i) => i.status === 'paid').length === 2 && list.filter((i) => i.status === 'unpaid').length === 2);
srv.close(); stubFac.close(); process.exit(bad ? 1 : 0);
