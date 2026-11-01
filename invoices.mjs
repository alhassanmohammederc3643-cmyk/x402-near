// Track 08: Real-World Money. An invoice server on top of the x402 payment flow.
// A business creates invoices; an accounts-payable agent pays the ones that pass
// its policy and skips the rest. Each invoice settles at most once.
// Testnet only: amounts are testnet wNEAR with no real value; memos are simulated.
import http from 'http';
import { randomUUID } from 'crypto';
import { accountFor, yocto, TOKEN } from './lib.mjs';

export function startInvoices({ port = 4405, facilitator = 'http://localhost:4402', payee } = {}) {
  const defaultPayee = payee || accountFor('seller').accountId;
  const invoices = new Map(); // id -> { id, amount, memo, payee, status, tx }
  const srv = http.createServer(async (rq, rs) => {
    const send = (c, o) => { rs.writeHead(c, { 'content-type': 'application/json' }); rs.end(JSON.stringify(o)); };
    let body = ''; for await (const c of rq) body += c;
    const url = new URL(rq.url, 'http://localhost');
    if (rq.method === 'POST' && url.pathname === '/invoices') {
      let b; try { b = JSON.parse(body || '{}'); } catch { return send(400, { error: 'bad json' }); }
      if (!b.amount || isNaN(Number(b.amount)) || Number(b.amount) <= 0) return send(400, { error: 'amount must be a positive number of testnet NEAR' });
      const id = 'INV-' + randomUUID().slice(0, 8);
      const inv = { id, amount: String(b.amount), memo: String(b.memo || ''), payee: String(b.payee || defaultPayee), status: 'unpaid', tx: null };
      invoices.set(id, inv);
      return send(201, inv);
    }
    if (rq.method === 'GET' && url.pathname === '/invoices') return send(200, [...invoices.values()]);
    const m = url.pathname.match(/^\/invoices\/([\w-]+)\/pay$/);
    if (m && rq.method === 'GET') {
      const inv = invoices.get(m[1]);
      if (!inv) return send(404, { error: 'unknown invoice' });
      if (inv.status === 'paid') return send(409, { error: 'invoice already settled', tx: inv.tx });
      const requirements = { scheme: 'exact', network: 'near-testnet', asset: TOKEN, assetNote: 'wNEAR on NEAR testnet, no real value', maxAmountRequired: yocto(inv.amount).toString(), payTo: inv.payee, payer: rq.headers['x-payer'], resource: url.pathname, description: `invoice ${inv.id}: ${inv.memo}` };
      const hdr = rq.headers['x-payment'];
      if (!hdr) return send(402, { x402Version: 1, error: 'payment required', accepts: [requirements] });
      inv.status = 'paying'; // a second attempt while settlement is in flight gets a 409
      const r = await fetch(facilitator + '/settle', { method: 'POST', body: JSON.stringify({ requirements, payload: hdr }) });
      const s = await r.json();
      if (!s.success) { inv.status = 'unpaid'; return send(402, { error: 'payment rejected', reason: s.reason || s.error }); }
      inv.status = 'paid'; inv.tx = s.transaction;
      rs.setHeader('x-payment-response', Buffer.from(JSON.stringify(s)).toString('base64'));
      return send(200, { ...inv, paid: s });
    }
    return send(404, {});
  });
  return new Promise((r) => srv.listen(port, () => r({ srv, invoices })));
}
