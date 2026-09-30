# Zenno

**Make your business bookable by every AI agent.**

The universal booking layer for appointment-based businesses. Zenno gives a
business a booking form *and* an agent-ready API so any AI assistant —
ChatGPT, Perplexity, Siri, or whatever comes next — can search live
availability, hold a slot, and book. Hamburg first.

- Live availability, normalized service data, and a universal `/agent/v1` API
- Hold-then-confirm bookings with TypeSafe confidence gating
- Merchant dashboard to control consent, API keys, and the agent activity log

## Local development

```bash
npm install
npm run dev
```

Brand URLs can be overridden with `VITE_PUBLIC_SITE_URL`,
`VITE_PUBLIC_APP_URL`, `VITE_PUBLIC_SUPPORT_URL`, and `VITE_PUBLIC_DOCS_URL`.

## Agent API

See [AGENT_API.md](./AGENT_API.md) for the full endpoint reference, auth, and
a worked agent conversation. Set `TYPESAFE_API_KEY` in Supabase Edge Function
secrets to enable confidence-gated bookings.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run unit tests (vitest) |
| `npm run test:coverage` | Unit tests with coverage |