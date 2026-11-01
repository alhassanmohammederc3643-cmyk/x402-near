# x402-near

HTTP 402 pay-per-call for AI agents on NEAR, plus an accounts-payable agent that settles invoices. **Testnet only. Test tokens, no real value.** Built for NEAR HACKATHON (1-14 Nov 2026).

Tracks: 07 Agent Economy, 06 AI Security & Defense, 08 Real-World Money.

NEAR features used: NEP-366 meta transactions (delegate actions relayed by a facilitator that pays the gas), NEP-141 `ft_transfer` on the testnet token `wrap.testnet`, public testnet RPC.

## The problem
An AI agent that uses paid APIs needs an account, an API key and a card at every provider. An agent with a wallet should pay per call instead, while a human keeps control over what it may spend. The same flow covers boring business money: paying invoices.

## What it does
- A seller API answers `402 Payment Required` with price and payee, x402 style.
- A buyer agent signs a NEP-366 delegate action calling `ft_transfer` for the exact amount. The buyer holds no gas and broadcasts no transaction.
- A facilitator verifies the signed payload (payee, amount, token, method, 1 yocto deposit, expiry, signature), relays it and pays the gas. Settled payloads go into a persistent replay store (`replay-store.mjs`, fsynced to disk). Exactly-once settlement is tested against the failure cases in `crash-test.mjs` (kill -9 mid-run, then restart: the settled payment is still rejected) and `concurrent-test.mjs` (two overlapping settle attempts on one invoice: exactly one succeeds). The on-chain delegate nonce is the second line of defense.
- A policy engine on the buyer runs before anything is signed: network and asset allowlist, payee allowlist, per-call cap, per-payee limit, session budget, kill switch. A denied call signs nothing and costs nothing.
- Track 08: an invoice server issues invoices (simulated memos, testnet wNEAR). An accounts-payable agent pays a batch under the same policy: invoices that pass settle onchain, over-budget and unknown-payee invoices are skipped, and a settled invoice rejects a second payment with 409.

## Why ft_transfer and not a native NEAR transfer
We tested native transfers inside a delegate action on testnet: the relayer paid the deposit, not the sender. A facilitator must not front money, so payments use `ft_transfer` with a 1 yocto deposit. The tokens come from the buyer; the relayer fronts only gas.

## Prior work disclosure (per the hackathon Q&A)
- x402 is an existing open HTTP 402 payment standard. This repo is a NEAR implementation of that flow.
- The team previously prototyped the same flow on another chain's testnet. Only the NEAR integration is submitted for judging.
- The hackathon Q&A (Q-001) counts code written since the announcement on 19 Oct 2026. The first commits here are dated 20 Oct 2026, after the announcement, and are tagged `pre-event-prototype-2026-10-20` anyway for clarity. Work dated inside the 1-14 Nov window includes the persistent replay store, the invoice/accounts-payable flow, the hermetic and crash/concurrency tests, the LICENSE and this README. Compare view once the `hackathon-submission` tag is up: `https://github.com/alhassanmohammederc3643-cmyk/x402-near/compare/pre-event-prototype-2026-10-20...hackathon-submission`.

## Try it
Setup (once):
1. `npm install`
2. Put testnet keys for the roles `buyer`, `seller`, `facilitator` in `.keys.json` (git-ignored) or in `NEAR_KEYS_JSON`. Fund the accounts from a testnet faucet.
3. `node setup.mjs` - registers token storage and wraps 1 testnet NEAR for the buyer.

Tests that need no keys and no chain (stub facilitator, nothing signed on a deny):
4. `node replay-test.mjs` - see 5 PASS: a settled payment stays settled across a restart.
5. `node policy-test.mjs` - see 5 PASS: per-call cap, per-payee limit, session budget and kill switch.
6. `node invoice-test.mjs` - see 6 PASS: two invoices paid, over-cap and unknown-payee invoices skipped, a settled invoice rejects a second payment.
7. `node crash-test.mjs` - see 4 PASS: settle, kill -9, restart, same payment still rejected, a different payment still settles (stub relayer; the verifier and signature check run for real).
8. `node concurrent-test.mjs` - see 3 PASS: two overlapping pay attempts on one invoice settle exactly once.

Live testnet runs:
9. `node web.mjs` and open http://localhost:4500. Press **Run agent** - see 7 tasks: 3 paid onchain with explorer links, 4 blocked by policy with reasons; buyer wNEAR down, seller wNEAR up. Press **Pay invoice batch** - see 2 of 4 invoices paid with transaction links, 2 skipped with reasons; each paid invoice settles exactly once.
10. `node demo.mjs` - see one paid call settled onchain (explorer link printed), an over-cap call blocked, a replayed payment rejected, and balances moving as expected.
11. `node invoice-demo.mjs` - see the accounts-payable agent pay 2 of 4 invoices onchain, skip the rest, and a repeated payment rejected with 409.
12. `node test.mjs` - see the facilitator verifier reject wrong payee, amount, token, method and deposit.

Explorer links have the form `https://testnet.nearblocks.io/txns/<hash>`.

## Files
| File | Role |
| --- | --- |
| `seller.mjs` | Paywalled API, answers 402 with price and payee |
| `facilitator.mjs` | Verifies signed delegate actions, relays them, pays gas |
| `replay-store.mjs` | Persistent replay protection, fsynced hashes on disk |
| `buyer.mjs` | Policy engine + buyer agent; account is injectable for tests |
| `invoices.mjs` | Invoice server on top of the payment flow (Track 08) |
| `agent.mjs` | Task-list agent used by the web demo |
| `web.mjs` / `index.html` | Demo UI on port 4500 |
| `setup.mjs` | One-time testnet setup |
| `demo.mjs` / `invoice-demo.mjs` | Live CLI demos |
| `test.mjs` | Facilitator verifier negative tests (needs keys) |
| `policy-test.mjs` / `invoice-test.mjs` / `replay-test.mjs` / `crash-test.mjs` / `concurrent-test.mjs` | Hermetic tests, no keys needed |
| `test-helpers.mjs` | Offline delegate signing for the hermetic tests |

## Status and limits
- Prototype. Single scheme (`exact`). No mainnet code path; testnet `wrap.testnet` only, no real stablecoin.
- Scoped function-call access key for the agent is unexplored: `ft_transfer` needs a 1 yocto deposit, which function-call keys cannot attach (not tested).
- Invoice state is in memory; a restart clears the ledger (the replay store is the part that persists).
