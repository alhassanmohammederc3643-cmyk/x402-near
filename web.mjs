// Demo UI: node web.mjs, open http://localhost:4500, press "Run agent". Testnet only.
import http from 'http'; import fs from 'fs';
import { startFacilitator } from './facilitator.mjs'; import { startSeller } from './seller.mjs'; import { runAgent } from './agent.mjs';
await startFacilitator(); await startSeller();
let last = null, running = false;
http.createServer(async (rq, rs) => {
  if (rq.url === '/api/run' && rq.method === 'POST') { if (!running) { running = true; try { last = await runAgent(); } finally { running = false; } } rs.writeHead(200, { 'content-type': 'application/json' }); return rs.end(JSON.stringify(last)); }
  if (rq.url === '/api/last') { rs.writeHead(200, { 'content-type': 'application/json' }); return rs.end(JSON.stringify(last)); }
  rs.writeHead(200, { 'content-type': 'text/html' }); rs.end(fs.readFileSync(new URL('./index.html', import.meta.url)));
}).listen(4500, () => console.log('demo on http://localhost:4500'));
