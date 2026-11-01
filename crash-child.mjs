// Helper process for crash-test.mjs: a facilitator with a stub relayer (no keys, no broadcast).
import { startFacilitator } from './facilitator.mjs';
const [port, storePath] = [Number(process.argv[2]), process.argv[3]];
const relayer = { accountId: 'facilitator-stub.testnet', async signAndSendTransaction() { return { transaction: { hash: 'stub-relay-tx' } }; } };
await startFacilitator(port, { storePath, relayer });
console.log('ready');
