# EM ROUNDS with PK — Development Progress

**Updated:** 22 November 2026  
**Phase:** 03 — Supabase Integration & Authentication

## Current baseline

- Next.js App Router, React, TypeScript and Tailwind foundation exists.
- Existing Supabase browser client was present before Phase 03.
- Supabase production project: `em-rounds-dev` (`lvibpreaunarbznjqaqs`).
- Eleven database migrations are reported applied and synchronized.
- Database schema includes profiles, roles, role assignment trigger, RLS and role-check functions.

## Phase 03 source implementation prepared

- [x] Separate browser and server Supabase client modules authored.
- [x] Next.js 16 `src/proxy.ts` session-refresh integration authored.
- [x] Email/password signup and sign-in UI authored.
- [x] Google OAuth initiation authored; provider dashboard configuration remains required.
- [x] PKCE auth callback authored.
- [x] Password reset request and completion UI authored.
- [x] Protected account route authored.
- [x] Database-verified admin route protection authored.
- [x] Sign-out UI authored.
- [x] Environment example and implementation documentation authored.
- [x] No database migrations or production schema changes made.

## Not yet verified

- [ ] Install `@supabase/ssr` in the working project.
- [ ] Run ESLint.
- [ ] Run production build / TypeScript checks.
- [ ] Configure local and Vercel environment variables.
- [ ] Configure production email confirmation, SMTP and redirect URLs.
- [ ] Configure Google OAuth provider, if Google login is to be enabled.
- [ ] Execute end-to-end auth tests with real test accounts.
- [ ] Verify student/admin access boundaries against production RLS.

**Status:** Source implementation prepared; not yet runtime-tested or deployed.
