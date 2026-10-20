# x402-near

HTTP 402 pay-per-call for AI agents on NEAR. **Testnet only. Test tokens, no real value. Work in progress, built for NEAR HACKATHON (Nov 2026).**

## What it does
A seller API answers `402 Payment Required` with price and payee. A buyer agent signs a NEP-366 delegate action that calls `ft_transfer` on a NEP-141 token (testnet `wrap.testnet`). A facilitator checks the signed payload, relays it and pays the gas. The buyer holds no gas and sends no transaction. The seller then serves the data.

The buyer agent has a policy engine that runs before anything is signed: per-call cap, session budget, payee and asset allowlist.

## Why a token transfer and not a native NEAR transfer
We tested native transfers inside a delegate action on testnet. The relayer paid the deposit, not the sender. A facilitator must not front money, so payments use `ft_transfer` with a 1 yocto deposit: the tokens come from the buyer, the relayer fronts only gas.

## Try it
1. `npm install`
2. Put testnet keys for roles `buyer`, `seller`, `facilitator` in `.keys.json` (git-ignored) or `NEAR_KEYS_JSON`. Fund the accounts from a testnet faucet.
3. `node setup.mjs` - registers token storage, buyer wraps 1 testnet NEAR.
4. `node web.mjs` and open http://localhost:4500, press Run agent: an agent works through 7 tasks under policy (3 paid onchain, 4 blocked). Or `node demo.mjs` - see: one paid call settled onchain, an over-cap call blocked by policy, a replayed payment rejected, balances (buyer token balance down, seller up, buyer NEAR unchanged, facilitator NEAR down by gas).
5. `node test.mjs` - verifier rejects wrong payee, amount, token, method and deposit.

## Files
`seller.mjs` paywalled API, `facilitator.mjs` verify and settle, `buyer.mjs` policy buyer, `lib.mjs` accounts and RPC.

## Status
Prototype. In-memory replay set. Single scheme (`exact`). No mainnet code path.
