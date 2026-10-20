// Buyer agent. Policy engine decides before anything is signed: per-call cap, session budget, payee allowlist.
import { accountFor, provider, nearApi, yocto } from './lib.mjs';
const { transactions } = nearApi;
import { encodeSignedDelegate } from '@near-js/transactions';
export class PolicyBuyer {
  constructor({ perCall = '0.05', budget = '0.1', allow = [] } = {}) {
    this.acct = accountFor('buyer'); this.perCall = yocto(perCall); this.budget = yocto(budget); this.spent = 0n; this.allow = allow; this.log = [];
  }
  async get(url) {
    const first = await fetch(url, { headers: { 'x-payer': this.acct.accountId } });
    if (first.status !== 402) return { status: first.status, body: await first.json() };
    const req = (await first.json()).accepts[0];
    const amt = BigInt(req.maxAmountRequired);
    const deny = (why) => { this.log.push({ url, denied: why }); return { status: 'blocked-by-policy', reason: why }; };
    if (req.network !== 'near-testnet') return deny('network not allowed');
    if (!this.allow.includes(req.payTo) || req.asset !== 'wrap.testnet') return deny('payee/asset not allowed');
    if (amt > this.perCall) return deny('over per-call cap');
    if (this.spent + amt > this.budget) return deny('session budget exhausted');
    const [, sd] = await this.acct.createSignedMetaTransaction(req.asset, [transactions.functionCall('ft_transfer', { receiver_id: req.payTo, amount: amt.toString() }, 30000000000000n, 1n)]);
    const payload = Buffer.from(encodeSignedDelegate(sd)).toString('base64');
    this.last = payload;
    const res = await fetch(url, { headers: { 'x-payer': this.acct.accountId, 'x-payment': payload } });
    const body = await res.json();
    if (res.status === 200) { this.spent += amt; this.log.push({ url, paid: amt.toString(), tx: body.paid.transaction }); }
    return { status: res.status, body };
  }
}
