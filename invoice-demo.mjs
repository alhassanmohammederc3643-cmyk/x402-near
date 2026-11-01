// Live invoice demo on NEAR testnet (Track 08, simulated funds): an accounts-payable
// agent works through a batch of invoices and pays the ones that pass its policy.
// Run: node invoice-demo.mjs   (needs .keys.json; run node setup.mjs once first)
import { startFacilitator } from './facilitator.mjs';
import { startInvoices } from './invoices.mjs';
import { PolicyBuyer } from './buyer.mjs';
import { accountFor, fmt, ftBalance } from './lib.mjs';

await startFacilitator();
const sellerId = accountFor('seller').accountId;
const { srv } = await startInvoices({ payee: sellerId });
const base = 'http://localhost:4405';
const post = (p, b) => fetch(base + p, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());

console.log('Issuing a batch of invoices (testnet wNEAR, simulated memos)...');
const batch = [
  await post('/invoices', { amount: '0.02', memo: 'design work (simulated)' }),
  await post('/invoices', { amount: '0.03', memo: 'hosting, one month (simulated)' }),
  await post('/invoices', { amount: '0.5', memo: 'consulting, over budget (simulated)' }),
  await post('/invoices', { amount: '0.01', memo: 'vendor with a different payee (simulated)', payee: 'unknown-vendor.testnet' }),
];
for (const i of batch) console.log(' ', i.id, i.amount, 'wNEAR ->', i.payee, '-', i.memo);

const bal = async (r) => fmt(await ftBalance(accountFor(r).accountId));
const before = { buyer: await bal('buyer'), seller: await bal('seller') };

const buyer = new PolicyBuyer({ perCall: '0.05', budget: '0.2', allow: [sellerId] });
console.log('\nAP agent paying the batch under policy (per-call 0.05, budget 0.2, allowlist: seller only)...');
for (const inv of batch) {
  const r = await buyer.get(`${base}/invoices/${inv.id}/pay`);
  if (r.status === 200) console.log(`  PAID    ${inv.id}  tx https://testnet.nearblocks.io/txns/${r.body.paid.transaction}`);
  else console.log(`  SKIPPED ${inv.id}  (${r.reason})`);
}

console.log('\nTrying to pay the first invoice a second time...');
const again = await fetch(`${base}/invoices/${batch[0].id}/pay`, { headers: { 'x-payer': buyer.acct.accountId, 'x-payment': buyer.last } });
console.log(' ', again.status, JSON.stringify(await again.json()));

const after = { buyer: await bal('buyer'), seller: await bal('seller') };
console.log('\nwNEAR balances (testnet, no real value): before', before, 'after', after);
console.log('Final ledger:', JSON.stringify(await fetch(base + '/invoices').then((r) => r.json()), null, 1));
srv.close();
process.exit(0);
