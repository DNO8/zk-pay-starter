# Manual Vercel deployment (testnet only)

The default payment mode is entirely browser-side: ephemeral test account keys, bearer notes, Merkle reconstruction, Groth16 proving, and Stellar transaction signing. Recipient authentication is mandatory. Create a fresh recipient in the same browser session and download its private testnet backup before closing the page. No production wallet or mainnet support is provided.

1. Finish the repository's isolated Groth16 testnet integration and verify `docs/evidence/private-payment.json` has a completed receipt.
2. From this directory run `bun run prepare:payment`. This copies only the finalized WASM, proving key and verification key, plus public deployment metadata and SHA-256 hashes, into `public/payment/`. It refuses incomplete evidence. Do not copy `.env`, `payment.secret`, witnesses, or private notes.
3. Run `bun run build`. In Vercel choose `apps/web` as Root Directory, Bun install, `bun run build`, and output `dist`. The supplied SPA rewrite preserves `/api`, `/payment`, and `/assets` paths.
4. Deploy manually. The `public/payment` artifacts must be included in the pushed source or regenerated from verified artifacts during a secure build. Check a real deposit, local browser proof, recipient-authenticated withdrawal and full-hash Stellar Expert links before calling the public deployment verified.

`vite.config.ts` `/api` proxy is development-only. Do not publish the separate `apps/api` Bun server: it is a trusted-local workshop signer/prover, not a hosted service. Browser mode does not need it.

## OpenRouter: required for contest completeness, disabled until configured

A real successful OpenRouter call in the payment flow is required for the contest. That requirement remains PENDING until the owner configures the credentials and explicitly clicks the AI button successfully; implementing the route does not complete it.

`api/ai.ts` is a separate Vercel function. Activation is optional for safely testing payments, but mandatory before declaring the contest submission complete. Default is disabled. Configure `OPENROUTER_API_KEY`, `OPENROUTER_MAX_CALLS` (1–10), and `AI_ACCESS_TOKEN` (at least 32 characters) server-side only, with an independently capped OpenRouter key. Never use `VITE_` prefixes for credentials. The owner supplies the access token in the page; it remains in memory and is sent only to this deployment's AI function. The function rejects custom prompts/payment data, uses a fixed synthetic educational prompt and max_tokens=180. No paid call runs automatically.

The call counter is per running process, resets at cold start/redeploy, and is NOT a global financial budget. A real provider-side spending cap is required. A shared access token is appropriate only for this private workshop deployment, not a multi-user product. Keep the endpoint disabled if those safeguards are unavailable.

## Privacy and limitations

This is a tutorial Groth16 setup, not an audited production ceremony. The small anonymity set, timing, public funding history, and recipients remain observable. Friendbot and Stellar public RPC receive public account/transaction data. No bearer note, secret key, private witness, or document goes to OpenRouter or the application backend in browser mode. RPC transport and published proving artifacts still need deployment-specific browser smoke testing.
