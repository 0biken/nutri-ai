# Deploying NutriAI to Vercel

The app lives in a subdirectory of this repo, so the Vercel project must be configured to use that as its root.

## One-time setup at vercel.com

1. Go to <https://vercel.com/new> and import the GitHub repo `0biken/nutri-ai`.
2. On the **Configure Project** screen, set:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `nutriai-implementation/nutriai`  ← important
   - **Build Command**: leave default (`next build`)
   - **Output Directory**: leave default (`.next`)
   - **Install Command**: leave default (`npm install`)
3. Expand **Environment Variables** and add these four (mark them for *Production*, *Preview*, and *Development*):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | your `pk_test_…` or `pk_live_…` |
   | `CLERK_SECRET_KEY` | your `sk_test_…` or `sk_live_…` |
   | `GEMINI_API_KEY` | your Google AI Studio key |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |

   (The two `_SIGN_IN_URL`/`_SIGN_UP_URL` vars default to `/sign-in` and `/sign-up`, which match our routes, so they can be omitted.)
4. Click **Deploy**.

## After deploy

- Get the production URL (e.g. `https://nutri-ai.vercel.app`).
- In the Clerk dashboard → **Configure → Domains**, add that production URL as an allowed origin, otherwise sign-in popups will fail with a CORS error.
- Visit `/api/health` — expect `{ status: "ok", model: "gemini-1.5-flash", echo: "OK", … }`.
- Visit `/dashboard` and smoke-test each tab.

## Ongoing

Every push to `main` triggers a production deploy. PRs get preview deploys automatically.

## Known prototype limits to fix before launch

- `/api/newsletter` only `console.log`s the signup (visible in Vercel function logs). Wire Resend / Vercel KV / Mailchimp before real launch.
- `src/lib/db.js` is an in-memory stub. Wire real Postgres + pgvector before adding production users.
- `src/lib/pgvector.js` returns no RAG context. Wire pgvector similarity search for the chat to use clinical protocols.
- Rotate any API keys that were ever pasted in chat or commits.
