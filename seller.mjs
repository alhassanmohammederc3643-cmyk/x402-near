// Paywalled API. No signup, no API key: GET /quote answers 402 with payment requirements.
import http from 'http';
import { accountFor, yocto, TOKEN } from './lib.mjs';
export function startSeller({ port = 4403, facilitator = 'http://localhost:4402', priceNear = '0.01' } = {}) {
  const payTo = accountFor('seller').accountId;
  const srv = http.createServer(async (rq, rs) => {
    const send = (c, o) => { rs.writeHead(c, { 'content-type': 'application/json' }); rs.end(JSON.stringify(o)); };
    if (rq.url !== '/quote') return send(404, {});
    const payer = rq.headers['x-payer'];
    const requirements = { scheme: 'exact', network: 'near-testnet', asset: TOKEN, assetNote: 'wNEAR on NEAR testnet, no real value', maxAmountRequired: yocto(priceNear).toString(), payTo, payer, resource: '/quote', description: 'One market quote (demo data)' };
    const hdr = rq.headers['x-payment'];
    if (!hdr) return send(402, { x402Version: 1, error: 'payment required', accepts: [requirements] });
    const r = await fetch(facilitator + '/settle', { method: 'POST', body: JSON.stringify({ requirements, payload: hdr }) });
    const s = await r.json();
    if (!s.success) return send(402, { error: 'payment rejected', reason: s.reason || s.error });
    rs.setHeader('x-payment-response', Buffer.from(JSON.stringify(s)).toString('base64'));
    send(200, { pair: 'NEAR/USD', price: 'demo-3.14', paid: s });
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
