# Fluvient

Learn English by watching YouTube. Fluvient turns any YouTube video into an
interactive lesson for Chinese speakers: a time-synced transcript, click-to-look-up
vocabulary, and AI-generated study notes — all bilingual (中文 / English).

> 粘贴 YouTube 链接，边看视频边学英语。

## Features

- **Watch + synced transcript** — the YouTube player and transcript scroll in sync;
  click any line to jump to that moment in the video.
- **Click-to-define** — tap a word for an instant definition and phonetics, or select a
  phrase/sentence to explain it. Save words, expressions, and full sentences to your notes.
- **AI study notes** — key vocabulary and key expressions with example sentences and Chinese
  translations, generated per video and cached by video + learner level.
- **CEFR-aware** — videos are graded (A1–C1) by the AI; the homepage gallery surfaces
  content at or above your level.
- **Bilingual UI** — every string lives in a single dictionary ([src/lib/i18n.ts](src/lib/i18n.ts));
  switch between 中文 and English at any time.
- **Lazy auth** — browse and watch anonymously; sign in (Google OAuth or email magic link)
  only when you want to save your notes.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth + Database | [Supabase](https://supabase.com) (Postgres, RLS, Auth) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai) — Google Gemini (default), with OpenAI & Anthropic support |
| Transcripts | [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript) |
| Validation | Zod |

The AI provider is pluggable ([src/lib/ai-provider.ts](src/lib/ai-provider.ts)): Gemini Flash by
default, with OpenAI and Anthropic available, and support for users supplying their own API key.

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>   # server-only; used for cache writes

# AI (default provider)
GOOGLE_GENERATIVE_AI_API_KEY=<your-gemini-key>

# Admin dashboard access (comma-separated emails)
ADMIN_EMAILS=you@example.com
```

### 3. Set up the database

Apply the SQL migrations in [supabase/migrations/](supabase/migrations/) to your Supabase
project (via the SQL editor or the Supabase CLI).

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/            # App Router pages & API routes (watch, admin, auth, api/…)
  components/     # UI: header, footer, transcript, popups, gallery, panels
  contexts/       # Auth & language providers
  lib/            # i18n, ai-provider, supabase clients, youtube, quota, admin
supabase/
  migrations/     # SQL migrations
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint |

## License

Fluvient is open source under the **[GNU Affero General Public License v3.0](LICENSE)**
(AGPL-3.0).

In short: you are free to use, study, modify, and redistribute this software. If you run a
modified version as a network service, the AGPL requires you to make the modified source
available to its users under the same license. See the full [LICENSE](LICENSE) for the
authoritative terms.
