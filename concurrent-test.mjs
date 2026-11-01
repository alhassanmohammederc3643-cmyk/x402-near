// Concurrent settlement on one invoice: two pay attempts in flight at once.
// Exactly one may settle; the other gets 409. Stub facilitator, no keys, no chain.
// Run: node concurrent-test.mjs
import http from 'http';
import { startInvoices } from './invoices.mjs';
import { PolicyBuyer } from './buyer.mjs';
import { fakeAccount } from './test-helpers.mjs';
const sellerId = 'seller-conc.testnet';
let settleCalls = 0;
const stubFac = http.createServer(async (rq, rs) => {
  settleCalls++;
  await new Promise((r) => setTimeout(r, 150)); // slow settlement so both attempts overlap
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ success: true, transaction: 'stub-tx-conc' }));
}).listen(4496);
const { srv } = await startInvoices({ port: 4497, facilitator: 'http://localhost:4496', payee: sellerId });
const inv = await fetch('http://localhost:4497/invoices', { method: 'POST', body: JSON.stringify({ amount: '0.02', memo: 'concurrent pay test (simulated)' }) }).then((r) => r.json());
const buyer = new PolicyBuyer({ perCall: '0.05', budget: '1', allow: [sellerId], acct: fakeAccount('buyer-conc.testnet') });
const url = `http://localhost:4497/invoices/${inv.id}/pay`;
const [r1, r2] = await Promise.all([buyer.get(url), buyer.get(url)]);
const outcomes = [r1.status, r2.status].sort();
let bad = 0; const t = (n, ok) => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n); };
t('exactly one of two concurrent attempts pays', outcomes[0] === 200 && outcomes[1] === 409);
t('facilitator saw exactly one settle', settleCalls === 1);
const list = await fetch('http://localhost:4497/invoices').then((r) => r.json());
t('invoice marked paid once', list[0].status === 'paid' && list[0].tx === 'stub-tx-conc');
srv.close(); stubFac.close(); process.exit(bad ? 1 : 0);
