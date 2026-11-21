
# EM ROUNDS with PK

A premium medical education platform focused on structured emergency medicine education and clinical knowledge assessment.

## Project Status

Foundation development.

The application currently contains:
- Next.js application foundation
- TypeScript
- Tailwind CSS
- Supabase client configuration
- Placeholder homepage

Product features have not yet been implemented.

## Technology Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL and Auth
- Zod
- React Hook Form
- Vercel
- Razorpay
- Mux (subject to video provider evaluation)

## Development Environment

The project is developed using:
- Ubuntu on WSL2
- Visual Studio Code
- Node.js
- npm
- Git

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure the Supabase environment variables in `.env.local`.

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run lint` | ESLint checks |
| `npm run build` | Production build |
| `npm run start` | Production server |

## Security

- Never commit `.env.local`.
- Never expose Supabase secret or service-role keys in browser code.
- Database access must be protected using appropriate Row Level Security policies.
- Sensitive payment and entitlement operations must be handled server-side.

## Development Principles

- Mobile-first responsive design.
- Modular application architecture.
- Type safety.
- Server-side validation for sensitive operations.
- Git checkpoints for meaningful milestones.
- No premature implementation of product features.

## Current Scope

The current phase is limited to establishing the development foundation.

Authentication, subscriptions, payments, video playback, QBank, administration and analytics will be implemented in later phases after their requirements are finalized.
