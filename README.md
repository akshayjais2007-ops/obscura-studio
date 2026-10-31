# Obscura — Full-Stack AI Video Studio (Frontend + Vercel Serverless Backend)

This repository contains the complete **Obscura** frontend (`src/`, `public/`) integrated with its **Vercel Serverless Backend** (`api/`) and PostgreSQL database schema (`docs/schema.sql`).

## Included Backend Endpoints (`api/`)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/integrations` | `GET` | Checks configured environment keys and runs live connectivity checks (`?test=1`) for all 10 provider categories |
| `/api/generate` | `POST` | Runs AI scriptwriting (`script`), Hook Battle generation (`hooks`), Publishing Pack copy (`titles`), and Fact-Check verification (`factcheck`) via OpenAI, Google Gemini, or the built-in server generator |
| `/api/stock` | `GET` | Searches stock photography and B-roll via the Pexels API (with curated built-in fallback media) |
| `/api/db` | `GET`, `POST` | Syncs relational workspace, project, and credit ledger state across sessions |
| `/api/checkout` | `POST` | Creates Stripe Checkout subscriptions (with instant sandbox plan upgrades when testing without Stripe keys) |

## Step-by-Step Deployment to GitHub & Vercel

1. **Unzip this project folder** on your computer.
2. **Upload to GitHub**:
   - Sign in to [GitHub](https://github.com) and click **New repository**.
   - Name it `obscura-studio` and click **Create repository**.
   - Click **uploading an existing file**, drag and drop all files and folders (`api`, `docs`, `public`, `src`, `package.json`, `vercel.json`, `vite.config.ts`, `index.html`, etc.) into the page, and click **Commit changes**.
3. **Deploy on Vercel**:
   - Sign in to [Vercel](https://vercel.com) with your GitHub account.
   - Click **Add New... -> Project** and import your `obscura-studio` repository.
   - Framework Preset will automatically detect **Vite**.
   - *(Optional)* Expand **Environment Variables** and add any API keys from `.env.example` (such as `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, or `STRIPE_SECRET_KEY`). Even with zero keys added, the built-in server engine powers `/api/integrations`, `/api/generate`, `/api/stock`, `/api/db`, and `/api/checkout` out of the box!
   - Click **Deploy**.
