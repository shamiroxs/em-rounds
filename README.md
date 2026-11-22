# EM ROUNDS with PK

A premium medical education platform focused on structured emergency medicine education and clinical knowledge assessment.

## Project status

Foundation development with Phase 03 authentication source prepared.

Current application foundation:
- Next.js App Router, React, TypeScript and Tailwind CSS
- Supabase browser and server integration source
- Cookie-based session refresh through Next.js 16 Proxy
- Email/password and Google OAuth authentication flows
- Protected account and administrator placeholder routes

The authentication source requires `@supabase/ssr` to be installed and the Supabase dashboard settings to be completed before it can be run. See `docs/AUTHENTICATION_IMPLEMENTATION.md` and `docs/SUPABASE_INTEGRATION.md`.

## Install dependencies

```bash
npm install
npm install @supabase/ssr
```

## Environment

```bash
cp .env.example .env.local
```

Add the Supabase project URL and publishable key to `.env.local`. Never commit `.env.local` or expose service-role/secret keys in browser code.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run lint` | ESLint checks |
| `npm run build` | Production build |
| `npm run start` | Production server |

## Production safety

The configured Supabase project is the production project. Do not run database reset or migration deployment commands as part of the authentication phase. The auth implementation uses the existing profiles, roles, RLS policies and role-check functions; it introduces no schema changes.
