# Business Finance Tracker

A full-stack web application for tracking business finances, replacing an Excel-based system. French UI with English codebase.

## Tech Stack

- **Frontend**: React 19 + TypeScript + TailwindCSS v4 + DaisyUI + TanStack Query
- **Backend**: Fastify 5 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: JWT (access + refresh tokens) + Passkeys/WebAuthn
- **Build**: Vite 7

## Project Structure

```
src/
├── client/           # React frontend
│   ├── api/          # API client (fetch wrapper)
│   ├── components/   # Reusable UI components
│   ├── contexts/     # React contexts (AuthContext)
│   ├── hooks/        # Custom hooks (useAuth, etc.)
│   ├── pages/        # Page components
│   └── utils/        # Utilities (passkey helpers)
├── server/           # Fastify backend
│   ├── auth/         # JWT, password, WebAuthn, middleware
│   ├── db/           # Drizzle schema & connection
│   └── routes/       # API routes
└── shared/           # Shared types between frontend/backend
    └── types.ts
```

## Commands

```bash
npm run dev          # Start both frontend and backend in dev mode
npm run dev:client   # Start Vite dev server only
npm run dev:server   # Start Fastify with tsx watch
npm run build        # Build both client and server
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema changes directly
npm run db:studio    # Open Drizzle Studio
```

## Key Patterns

### Authentication
- Access tokens (15min) stored in httpOnly cookies
- Refresh tokens (7 days) for token rotation
- `requireAuth` middleware protects routes, sets `request.authUser`
- WebAuthn/Passkeys supported for passwordless auth

### API Routes
- All routes prefixed with `/api/`
- Auth routes: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/me`
- Passkey routes: `/api/passkeys/*`
- Invoice routes: `/api/invoices`, `/api/invoices/:id`, `/api/invoices/summary/monthly`
- Expense routes: `/api/expenses`, `/api/expenses/:id`, `/api/expenses/summary/monthly`, `/api/expenses/recurring`
- Settings routes: `/api/settings`, `/api/settings/tax-brackets`, `/api/settings/calculate-tax`
- TVA routes: `/api/tva/payments`, `/api/tva/payments/:id`, `/api/tva/summary`, `/api/tva/monthly`
- Urssaf routes: `/api/urssaf/payments`, `/api/urssaf/payments/:id`, `/api/urssaf/summary`, `/api/urssaf/calculate`
- Dashboard routes: `/api/dashboard/summary`
- Account routes: `/api/account/balance`, `/api/account/summary`
- Income Tax routes: `/api/income-tax/payments`, `/api/income-tax/payments/:id`, `/api/income-tax/summary`
- Use Zod for input validation with `.issues[0].message` for error messages

### Frontend
- `AuthProvider` wraps the app, provides `useAuth()` hook
- `ProtectedRoute` component guards authenticated routes
- TanStack Query for data fetching with `useQuery`/`useMutation`
- API client at `src/client/api/client.ts` handles fetch with credentials

### Database
- Drizzle ORM with PostgreSQL
- All tables have `userId` foreign key for data isolation
- Schema defined in `src/server/db/schema.ts`

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/business_finance
JWT_SECRET=your-secret-key
COOKIE_SECRET=your-cookie-secret
CORS_ORIGIN=http://localhost:5173
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Business Finance Tracker
WEBAUTHN_ORIGIN=http://localhost:5173
```

## Current Status

- **Phase 1**: Complete - Project setup, Fastify, React, Drizzle, security middleware
- **Phase 2**: Complete - Full authentication (email/password + passkeys)
- **Phase 3**: Complete - Core data models and CRUD APIs (invoices, expenses, settings)
- **Phase 4**: Complete - Invoice Management (UI)
- **Phase 5**: Complete - Expense Management (UI)
- **Phase 6**: Complete - Tax & Contributions (TVA, Urssaf)
- **Phase 7**: Complete - Financial Overview (Dashboard, Business Account)
- **Phase 8**: Complete - Income Tax (tax brackets, estimation, tracking)
- **Phase 9**: Next - Calculator Tool
- **Phase 10**: Pending - Polish & Deployment

## Notes

- French UI labels (e.g., "Connexion", "Déconnexion", "Tableau de bord")
- Financial amounts use `decimal(12,2)` in database
- All dates stored as `date` type, timestamps as `timestamp`
