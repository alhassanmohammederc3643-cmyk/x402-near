// A buyer agent working through a task list under policy. Returns a structured run log.
import { PolicyBuyer } from './buyer.mjs';
import { accountFor, ftBalance, fmt } from './lib.mjs';
export async function runAgent(base = 'http://localhost:4403', policy = { perCall: '0.05', budget: '0.07' }) {
  const seller = accountFor('seller').accountId;
  const buyer = new PolicyBuyer({ ...policy, allow: [seller] });
  const steps = [['Get the NEAR/USD quote', '/quote'], ['Get Accra weather', '/weather'], ['Get the market summary', '/summary'], ['Buy the premium dataset', '/premium'], ['Call a paywall with an unknown payee', '/rogue'], ['Get a second quote', '/quote'], ['Get a third quote', '/quote']];
  const bal = async () => ({ buyerWNEAR: fmt(await ftBalance(buyer.acct.accountId)), sellerWNEAR: fmt(await ftBalance(seller)) });
  const before = await bal();
  const out = [];
  for (const [task, path] of steps) {
    const r = await buyer.get(base + path);
    out.push({ task, path, result: r.status === 200 ? 'paid' : r.status === 'blocked-by-policy' ? 'blocked' : 'error', reason: r.reason || r.body?.reason, tx: r.body?.paid?.transaction, price: r.body?.paid ? null : undefined });
  }
  return { network: 'NEAR testnet (no real value)', buyer: buyer.acct.accountId, seller, policy: { ...policy, allowlist: [seller] }, before, after: await bal(), steps: out, spentWNEAR: fmt(buyer.spent) };
}
