import fs from 'fs';
import nearApi from 'near-api-js';
const { Account, KeyPair, KeyPairSigner, providers, transactions, utils } = nearApi;
export const NETWORK = 'near-testnet'; // testnet only; no mainnet code path
export const RPC = process.env.NEAR_RPC || 'https://test.rpc.fastnear.com';
export const provider = new providers.JsonRpcProvider({ url: RPC });
export const yocto = (n) => BigInt(utils.format.parseNearAmount(String(n)));
export const fmt = (y) => utils.format.formatNearAmount(y.toString(), 5);
export function loadKeys() {
  // keys come from env (NEAR_KEYS_JSON) or a git-ignored local file; never committed
  const raw = process.env.NEAR_KEYS_JSON || fs.readFileSync(new URL('./.keys.json', import.meta.url));
  return JSON.parse(raw);
}
export function accountFor(role) {
  const k = loadKeys()[role];
  const signer = new KeyPairSigner(KeyPair.fromString(k.secret));
  return new Account(k.account, provider, signer);
}
export { nearApi, transactions, utils, Account };
export const TOKEN = 'wrap.testnet'; // testnet wrapped NEAR (NEP-141); no real value
export const ftBalance = async (id) => BigInt(await provider.callFunction(TOKEN, 'ft_balance_of', { account_id: id }));
