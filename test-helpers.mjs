// Hermetic test account: a real ed25519 keypair generated locally, delegate actions
// built and signed offline. No keys file, no faucet, no chain calls. Tests only.
import { KeyPair, KeyPairSigner } from 'near-api-js';
import { buildDelegateAction } from '@near-js/transactions';
export function fakeAccount(id) {
  const signer = new KeyPairSigner(KeyPair.fromRandom('ed25519'));
  let nonce = 0n;
  return {
    accountId: id,
    async createSignedMetaTransaction(receiverId, actions) {
      nonce += 1n; // unique nonce per call so each signed payload differs
      const delegateAction = buildDelegateAction({
        senderId: id,
        receiverId,
        actions,
        nonce,
        maxBlockHeight: 10n ** 18n, // far future so it never expires during a test
        publicKey: await signer.getPublicKey(),
      });
      return signer.signDelegateAction(delegateAction);
    },
  };
}
