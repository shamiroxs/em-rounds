# EM ROUNDS with PK — Supabase Integration

## Project connection

The application is intended to connect to the existing production Supabase project:

- Project name: `em-rounds-dev`
- Project reference: `lvibpreaunarbznjqaqs`

The name `em-rounds-dev` does not mean this is a disposable development database; the project owner has confirmed it is the production project. No database changes are part of this authentication implementation.

## Client separation

| Client | File | Runtime | Key |
|---|---|---|---|
| Browser | `src/lib/supabase/client.ts` | Browser Client Components | Supabase publishable key |
| Server | `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | Supabase publishable key plus request cookies |
| Session refresh | `src/proxy.ts` | Next.js Proxy | Supabase publishable key plus request/response cookies |

No service-role client is created. Sensitive role decisions use the existing database functions under the user's authenticated session.

## Environment setup

Required variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Set these in `.env.local` for local development and in Vercel Environment Variables for the appropriate deployment environments. `.env.local` is ignored by Git.

The publishable key is designed for use in a browser and does not grant elevated database permissions. PostgreSQL grants and RLS remain the authorization boundary.

## Supabase Dashboard configuration

Complete these settings in the Supabase dashboard for the existing project:

1. **Authentication → URL Configuration**
   - Set the Site URL to the real production application URL.
   - Add the exact local callback URL `http://localhost:3000/auth/callback` to Redirect URLs.
   - Add the exact production callback URL `https://YOUR_PRODUCTION_DOMAIN/auth/callback`.
   - If using preview deployments, add only the required preview callback patterns/URLs.
2. **Authentication → Providers → Email**
   - Enable email provider.
   - Enable email confirmations for production signups.
   - Configure a production SMTP sender before public launch; the default test mail service is not a production email-delivery solution.
3. **Authentication → Providers → Google**
   - Enable Google only after configuring the Google OAuth client ID and client secret in the dashboard.
   - Register the Supabase Auth callback URL shown by the dashboard in the Google Cloud OAuth client.
   - Add the application callback URL to the Supabase redirect allow-list.
4. **Authentication → Email Templates**
   - Review confirmation and password-reset templates and ensure their links return to the configured application callback.

Do not share provider secrets in chat, source files, or `.env.example`.

## Database identity and authorization

The supplied deployed migration files establish the following behavior:

- `auth.users` is the authentication identity source.
- `public.profiles.id` references `auth.users.id`.
- `on_auth_user_created` invokes `public.handle_new_auth_user()`.
- The trigger creates a profile and assigns the `student` role.
- `public.has_role(text)` verifies a role for `auth.uid()`.
- `public.is_admin()` recognizes `admin` and `owner_admin`.
- `user_roles_admin_manage` restricts role writes to `owner_admin` under RLS.
- Profile reads are restricted to self or admin; profile updates are restricted to self.

The app intentionally does not accept role names from signup metadata or profile forms.

## Production safety

Do not run `supabase db reset`, `supabase db push`, or any schema-changing command as part of this authentication task. No new migration is required by the code in this package. If future runtime evidence reveals a database defect, prepare a separate migration proposal and obtain explicit approval before applying it to production.
