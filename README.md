# LeetLoop

LeetLoop is a cloud-backed spaced-repetition tracker for LeetCode-style interview prep. It helps answer the daily question: what should I revisit today?

Live app: https://useleetloop.vercel.app

## Features

- Cloud accounts with Supabase Auth and Postgres.
- Google and GitHub sign-in.
- Today queue for due reviews, overdue work, planned new starts, and completed work.
- Fast attempt logging with automatic review scheduling.
- Configurable daily practice target.
- Built-in LeetCode 75, Top Interview 150, and NeetCode 150 templates.
- LeetCode Daily card with add/log flow.
- Analytics for active work, due load, weak patterns, and pattern coverage.
- JSON export/import for backup and portability.
- Optional unpacked Chrome extension spoiler shield for LeetCode review links.

## Chrome Extension

The extension adds a spoiler shield for LeetCode review sessions. LeetLoop problem links add `?leetloop=review`, and the unpacked extension hides the LeetCode code editor until you start fresh, reveal previous code, or dismiss the shield.

To try it locally:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this repo's `extension` folder.

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Apply `supabase/migrations/0001_init.sql` in the Supabase SQL Editor before using the app.

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Deployment

Recommended deployment is Vercel for the Next.js app and Supabase for Auth/Postgres.

Set these Vercel environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

In Supabase Auth settings, set the production Site URL and add redirect URLs for production, localhost, and Vercel previews. Also configure the same production redirect URL in the Google/GitHub OAuth provider dashboards.
