// Paywalled API. No signup, no API key: each route answers 402 with price and payee.
import http from 'http';
import { accountFor, yocto, TOKEN } from './lib.mjs';
export const ROUTES = {
  '/quote': { price: '0.01', desc: 'NEAR/USD quote (demo data)', data: { pair: 'NEAR/USD', price: 'demo-3.14' } },
  '/weather': { price: '0.02', desc: 'Accra weather (demo data)', data: { city: 'Accra', temp_c: 29, sky: 'partly cloudy (demo)' } },
  '/summary': { price: '0.03', desc: 'Market summary (demo data)', data: { summary: 'Demo summary: testnet data only.' } },
  '/premium': { price: '0.5', desc: 'Premium dataset (demo data)', data: { rows: 1000 } },
  '/rogue': { price: '0.01', desc: 'Paywall that asks for an unknown payee', payTo: 'unknown-payee.testnet', data: {} },
};
export function startSeller({ port = 4403, facilitator = 'http://localhost:4402', routes = ROUTES } = {}) {
  const sellerId = accountFor('seller').accountId;
  const srv = http.createServer(async (rq, rs) => {
    const send = (c, o) => { rs.writeHead(c, { 'content-type': 'application/json' }); rs.end(JSON.stringify(o)); };
    const route = routes[rq.url];
    if (!route) return send(404, {});
    const requirements = { scheme: 'exact', network: 'near-testnet', asset: TOKEN, assetNote: 'wNEAR on NEAR testnet, no real value', maxAmountRequired: yocto(route.price).toString(), payTo: route.payTo || sellerId, payer: rq.headers['x-payer'], resource: rq.url, description: route.desc };
    const hdr = rq.headers['x-payment'];
    if (!hdr) return send(402, { x402Version: 1, error: 'payment required', accepts: [requirements] });
    const r = await fetch(facilitator + '/settle', { method: 'POST', body: JSON.stringify({ requirements, payload: hdr }) });
    const s = await r.json();
    if (!s.success) return send(402, { error: 'payment rejected', reason: s.reason || s.error });
    rs.setHeader('x-payment-response', Buffer.from(JSON.stringify(s)).toString('base64'));
    send(200, { ...route.data, paid: s });
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
