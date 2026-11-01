// x402 facilitator for NEAR testnet.
// Verifies a buyer-signed NEP-366 delegate action (single exact transfer), then relays it and pays the gas.
// The buyer never holds gas and never broadcasts a tx itself. Testnet only.
import http from 'http';
import { createHash } from 'crypto';
import { deserialize } from 'borsh';
import { SCHEMA, actionCreators, encodeDelegateAction } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { accountFor, provider } from './lib.mjs';
import { ReplayStore } from './replay-store.mjs';

export const decodeSigned = (b64) => deserialize(SCHEMA.SignedDelegate, Buffer.from(b64, 'base64'));

export async function verify(req, b64) {
  let sd; try { sd = decodeSigned(b64); } catch { return 'undecodable payload'; }
  const d = sd.delegateAction;
  if (req.network !== 'near-testnet') return 'testnet only';
  if (d.senderId !== req.payer) return 'sender != payer';
  if (d.receiverId !== req.asset) return 'receiver != token contract';
  if (d.actions.length !== 1 || !d.actions[0].functionCall) return 'must be exactly one function call';
  const fc = d.actions[0].functionCall;
  if (fc.methodName !== 'ft_transfer') return 'method must be ft_transfer';
  if (BigInt(fc.deposit.toString()) !== 1n) return 'deposit must be exactly 1 yocto';
  let args; try { args = JSON.parse(Buffer.from(fc.args).toString()); } catch { return 'bad args'; }
  if (args.receiver_id !== req.payTo) return 'payee != payTo';
  if (BigInt(args.amount) !== BigInt(req.maxAmountRequired)) return 'amount != price';
  const blk = await provider.block({ finality: 'final' });
  if (BigInt(d.maxBlockHeight) < BigInt(blk.header.height) + 2n) return 'delegate expired';
  const h = createHash('sha256').update(encodeDelegateAction(d)).digest();
  const pk = PublicKey.from('ed25519:' + (await import('bs58')).default.encode(Buffer.from(d.publicKey.ed25519Key.data)));
  if (!pk.verify(new Uint8Array(h), Uint8Array.from(sd.signature.ed25519Signature.data))) return 'bad signature';
  return null;
}

export function startFacilitator(port = 4402, { storePath } = {}) {
  const store = new ReplayStore(storePath);
  const acct = accountFor('facilitator');
  const srv = http.createServer(async (rq, rs) => {
    const send = (c, o) => { rs.writeHead(c, { 'content-type': 'application/json' }); rs.end(JSON.stringify(o)); };
    if (rq.method !== 'POST') return send(404, {});
    let body = ''; for await (const c of rq) body += c;
    try {
      const { requirements: req, payload } = JSON.parse(body);
      const why = await verify(req, payload);
      if (rq.url === '/verify') return send(200, { isValid: !why, reason: why });
      if (rq.url !== '/settle') return send(404, {});
      if (why) return send(200, { success: false, reason: why });
      if (store.has(payload)) return send(200, { success: false, reason: 'replay' });
      store.add(payload);
      const sd = decodeSigned(payload);
      const out = await acct.signAndSendTransaction({ receiverId: sd.delegateAction.senderId, actions: [actionCreators.signedDelegate(sd)] });
      const failed = JSON.stringify(out).includes('"Failure"');
      send(200, { success: !failed, transaction: out.transaction.hash, network: 'near-testnet', payer: req.payer, relayer: acct.accountId });
    } catch (e) { send(500, { error: String(e.message || e) }); }
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
