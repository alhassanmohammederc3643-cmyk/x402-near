// Demo UI: node web.mjs, open http://localhost:4500. Testnet only.
import http from 'http'; import fs from 'fs';
import { startFacilitator } from './facilitator.mjs'; import { startSeller } from './seller.mjs'; import { runAgent } from './agent.mjs';
import { startInvoices } from './invoices.mjs';
import { PolicyBuyer } from './buyer.mjs';
import { accountFor, fmt, ftBalance } from './lib.mjs';
await startFacilitator(); await startSeller();
const sellerId = accountFor('seller').accountId;
await startInvoices({ payee: sellerId });
let last = null, running = false, seeded = false, paying = false, lastBatch = null;
async function seed() {
  if (seeded) return; seeded = true;
  const post = (b) => fetch('http://localhost:4405/invoices', { method: 'POST', body: JSON.stringify(b) });
  await post({ amount: '0.02', memo: 'design work (simulated)' });
  await post({ amount: '0.03', memo: 'hosting, one month (simulated)' });
  await post({ amount: '0.5', memo: 'consulting, over budget (simulated)' });
  await post({ amount: '0.01', memo: 'vendor with a different payee (simulated)', payee: 'unknown-vendor.testnet' });
}
const invoiceList = () => fetch('http://localhost:4405/invoices').then((r) => r.json());
http.createServer(async (rq, rs) => {
  const json = (o) => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify(o)); };
  if (rq.url === '/api/run' && rq.method === 'POST') { if (!running) { running = true; try { last = await runAgent(); } finally { running = false; } } return json(last); }
  if (rq.url === '/api/last') return json(last);
  if (rq.url === '/api/invoices') { await seed(); return json({ invoices: await invoiceList(), lastBatch }); }
  if (rq.url === '/api/pay-invoices' && rq.method === 'POST') {
    await seed();
    if (!paying) {
      paying = true;
      try {
        const buyer = new PolicyBuyer({ perCall: '0.05', budget: '0.2', allow: [sellerId] });
        const unpaid = (await invoiceList()).filter((i) => i.status === 'unpaid');
        const before = { buyerWNEAR: fmt(await ftBalance(buyer.acct.accountId)), sellerWNEAR: fmt(await ftBalance(sellerId)) };
        const results = [];
        for (const inv of unpaid) {
          const r = await buyer.get(`http://localhost:4405/invoices/${inv.id}/pay`);
          results.push({ id: inv.id, amount: inv.amount, memo: inv.memo, payee: inv.payee, result: r.status === 200 ? 'paid' : 'skipped', reason: r.reason, tx: r.body?.paid?.transaction });
        }
        lastBatch = { results, before, after: { buyerWNEAR: fmt(await ftBalance(buyer.acct.accountId)), sellerWNEAR: fmt(await ftBalance(sellerId)) }, spentWNEAR: fmt(buyer.spent) };
      } finally { paying = false; }
    }
    return json({ invoices: await invoiceList(), lastBatch });
  }
  rs.writeHead(200, { 'content-type': 'text/html' }); rs.end(fs.readFileSync(new URL('./index.html', import.meta.url)));
}).listen(4500, () => console.log('demo on http://localhost:4500'));
