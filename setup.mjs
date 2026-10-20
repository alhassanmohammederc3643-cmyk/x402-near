// One-time testnet setup (idempotent enough for a demo): register storage on the token, buyer wraps 1 testnet NEAR.
import { accountFor, TOKEN, ftBalance, yocto, fmt } from './lib.mjs';
const b = accountFor('buyer'), s = accountFor('seller');
const gas = 30000000000000n;
for (const a of [s, b]) await a.callFunction({ contractId: TOKEN, methodName: 'storage_deposit', args: { account_id: a.accountId, registration_only: true }, deposit: yocto('0.00125'), gas });
if ((await ftBalance(b.accountId)) < yocto('0.5')) await b.callFunction({ contractId: TOKEN, methodName: 'near_deposit', args: {}, deposit: yocto('1'), gas });
console.log('buyer wNEAR', fmt(await ftBalance(b.accountId)), 'seller wNEAR', fmt(await ftBalance(s.accountId)));
