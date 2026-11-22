# EM ROUNDS with PK — Database Migration Package

**Status:** prepared for review; not applied to Supabase.

This package contains a first-pass PostgreSQL/Supabase schema implementation based on the approved database architecture and decisions:
- One-time INR payments.
- Lifetime platform-wide access for the launch product.
- Email and Google sign-in through Supabase Auth.
- Student, content editor, admin, and owner admin roles.
- Practice-question QBank (no timed/mock exams in the initial release).
- Private answer keys and explanations; explanations are returned only by the trusted submission function.
- RLS and server-side authorization boundaries.

## Important safety notes

1. These SQL files have **not** been executed against your Supabase project.
2. Do not paste the migrations into the production SQL editor as one large script.
3. Review and test in a separate development Supabase project first.
4. Payment provider webhook signature verification must happen on your trusted server before calling payment/refund functions.
5. Keep the Supabase service-role key on the server only. Never expose it to browser code.
6. Do not expose the `private` schema through Supabase's API exposed-schema configuration.
7. The `owner_admin` role must be provisioned manually through a trusted administrative process after the owner's Auth account exists.
8. The initial product price is intentionally not seeded. Decide the actual INR price before making the product purchasable.

## Contents

- `migrations/00001_extensions_and_helpers.sql`
- `migrations/00002_identity_and_roles.sql`
- `migrations/00003_educational_content.sql`
- `migrations/00004_purchases_and_entitlements.sql`
- `migrations/00005_question_bank.sql`
- `migrations/00006_student_learning.sql`
- `migrations/00007_administration.sql`
- `migrations/00008_constraints_indexes_and_immutability.sql`
- `migrations/00009_rls_and_grants.sql`
- `migrations/00010_trusted_database_functions.sql`
- `seed.sql`
- `tests/database_integrity.sql`
- `tests/database_security_review.sql`

## Suggested implementation sequence

1. Create a **separate development Supabase project**.
2. Install/use Supabase CLI and link it to that development project.
3. Copy the migration files into your repository's `supabase/migrations/` directory.
4. Review the SQL with a developer before applying it.
5. Apply migrations to the development project.
6. Run structural checks and perform real tests using at least two student accounts, one content editor, and one admin.
7. Only after successful testing, plan a production migration separately.

## Decisions that still require implementation-time configuration

- Actual launch price in INR.
- Razorpay account/provider identifiers and webhook configuration.
- Owner-admin bootstrap identity.
- Media storage bucket names and policies.
- Whether lecture progress can be manually updated by the student or must be driven by verified playback events.
- Final question type support beyond single-best-answer MCQ.

## Scope boundaries

This package does not configure Storage buckets, Mux, Razorpay, email templates, frontend routes, UI, or production deployment. Those are separate implementation tasks.
