# EM ROUNDS with PK — Authentication Implementation

**Scope:** Phase 03 — Supabase integration and authentication  
**Target:** Existing Next.js 16 App Router application  
**Database:** Existing Supabase project `em-rounds-dev` (`lvibpreaunarbznjqaqs`)  
**Database changes:** None. No migrations were created or applied.

## Implemented in the source package

- Supabase browser client using `createBrowserClient` from `@supabase/ssr`.
- Supabase server client using the Next.js asynchronous `cookies()` API.
- `src/proxy.ts` refreshes Supabase Auth sessions and writes refreshed cookies to the request and response.
- Email/password signup and sign-in.
- Google OAuth initiation.
- Email verification callback using the PKCE authorization code exchange.
- Password-reset email request and password update page.
- Sign-out.
- Protected `/account` page.
- Protected `/admin` page using the deployed `public.is_admin()` database function.
- Account role display using `public.has_role()` and `public.is_admin()`.
- Profile lookup limited to the signed-in user's own row.
- Signup relies on the existing `on_auth_user_created` database trigger to create the profile and assign the `student` role. The browser does not write roles.

## Existing database contract used

The supplied migrations define:

- `public.profiles`: `id`, `display_name`, `avatar_url`, timestamps.
- `public.user_roles`: assigned roles, with self-read/admin-read RLS.
- `public.handle_new_auth_user()`: creates a profile and assigns the default `student` role.
- `public.has_role(required_role text)`: verifies a role for the authenticated identity.
- `public.is_admin()`: returns true for `admin` or `owner_admin`.

No second profile table, role table, or role-assignment mechanism was added.

## Required dependency installation

The supplied project did not include `@supabase/ssr`. From the project root run:

```bash
npm install @supabase/ssr
```

This updates `package.json` and `package-lock.json` using the current compatible package release. Then run:

```bash
npm run lint
npm run build
```

Do not deploy until both commands pass and the manual authentication checks below are complete.

## Environment variables

Copy `.env.example` to `.env.local`, then enter the Supabase Project URL and publishable key from the Supabase dashboard. Do not paste credentials into chat or commit `.env.local`.

This implementation does not need a service-role key. Do not add one to a `NEXT_PUBLIC_*` variable.

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Project landing page |
| `/signup` | Public | Create account |
| `/login` | Public | Sign in |
| `/forgot-password` | Public | Request password reset |
| `/auth/callback` | Auth callback | Exchange PKCE code for a session |
| `/reset-password` | Authenticated recovery session | Set new password |
| `/account` | Authenticated | Display own profile and database-verified role |
| `/admin` | `admin` or `owner_admin` | Restricted placeholder admin page |

The Proxy refreshes sessions; it is not treated as the sole authorization boundary. Protected pages independently verify claims and database role status. Future Server Actions and Route Handlers must repeat authorization checks inside each operation.

## Manual verification checklist

- [ ] New email signup creates a Supabase Auth user.
- [ ] The database trigger creates exactly one matching profile.
- [ ] The database trigger assigns `student` and no elevated role.
- [ ] Email verification link returns through `/auth/callback`.
- [ ] Existing email/password login succeeds.
- [ ] Incorrect password is rejected.
- [ ] Google OAuth succeeds after provider configuration.
- [ ] Password reset email arrives and reset completes.
- [ ] Refreshing `/account` preserves the session.
- [ ] Sign-out clears the session and `/account` redirects to `/login`.
- [ ] A student cannot open `/admin`.
- [ ] An admin/owner_admin can open `/admin`.
- [ ] Student A cannot read Student B's profile.
- [ ] A student cannot insert/update/delete their own `user_roles` rows.
- [ ] No service-role key appears in browser bundles or client source.

These checks are not marked passed by this implementation package. They must be executed against the configured environment.
