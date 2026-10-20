// Negative tests for the facilitator verifier (no broadcast). Run: node test.mjs
import { verify } from './facilitator.mjs';
import { accountFor, nearApi, TOKEN } from './lib.mjs';
import { encodeSignedDelegate } from '@near-js/transactions';
const b = accountFor('buyer'), s = accountFor('seller');
const mk = async (o = {}) => {
  const [, sd] = await b.createSignedMetaTransaction(o.token || TOKEN, [nearApi.transactions.functionCall(o.method || 'ft_transfer', { receiver_id: o.to || s.accountId, amount: o.amount || '10000000000000000000000' }, 30000000000000n, o.dep ?? 1n)]);
  return Buffer.from(encodeSignedDelegate(sd)).toString('base64');
};
const req = { network: 'near-testnet', asset: TOKEN, payTo: s.accountId, payer: b.accountId, maxAmountRequired: '10000000000000000000000' };
const cases = [['valid', {}, null], ['wrong payee', { to: b.accountId }, 'payee != payTo'], ['wrong amount', { amount: '1' }, 'amount != price'], ['wrong token', { token: 'evil.testnet' }, 'receiver != token contract'], ['wrong method', { method: 'ft_transfer_call' }, 'method must be ft_transfer'], ['big deposit', { dep: 10n ** 24n }, 'deposit must be exactly 1 yocto']];
let bad = 0;
for (const [n, o, want] of cases) { const got = await verify(req, await mk(o)); const ok = got === want; if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, '->', got); }
process.exit(bad ? 1 : 0);
