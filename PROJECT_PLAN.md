# Business Finance Tracker - Project Plan

## Overview
A full-stack web application to replace the current Excel-based business finance tracking system. French UI with English codebase.

## Tech Stack
- **Frontend**: React + TypeScript + TailwindCSS + DaisyUI + TanStack Query
- **Backend**: Fastify + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Full auth system (JWT + Passkeys/WebAuthn)
- **Deployment**: Self-hosted server (Docker-based)
- **Structure**: Single package (no monorepo)

---

## Security Considerations

Since this application handles sensitive financial data and will be deployed publicly, security is paramount.

### Authentication & Authorization
- **Password Security**: bcrypt with cost factor 12+ for password hashing
- **Passkeys (WebAuthn)**: Phishing-resistant passwordless authentication
  - Support device biometrics (Touch ID, Face ID, Windows Hello)
  - Hardware security keys (YubiKey, etc.)
  - Cross-device authentication via QR code
- **JWT Tokens**: Short-lived access tokens (15min) + HTTP-only refresh tokens (7 days)
- **Secure Cookies**: `httpOnly`, `secure`, `sameSite=strict` flags on all auth cookies
- **Rate Limiting**: Limit login attempts (5 per minute per IP) to prevent brute force
- **Account Lockout**: Temporary lockout after repeated failed login attempts

### API Security
- **Input Validation**: Zod schemas for all API inputs (never trust client data)
- **SQL Injection Prevention**: Drizzle ORM with parameterized queries (never raw SQL with user input)
- **CORS Configuration**: Strict origin whitelist, no wildcards in production
- **Helmet.js**: Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
- **Request Size Limits**: Cap request body size to prevent DoS

### Data Protection
- **HTTPS Only**: TLS/SSL required in production (use Let's Encrypt or similar)
- **Environment Variables**: All secrets in `.env` files, never committed to git
- **Database Security**: Strong passwords, connection via SSL, restricted network access
- **Data Isolation**: All queries filtered by `user_id` to prevent data leakage between users

### Frontend Security
- **XSS Prevention**: React's default escaping + CSP headers
- **CSRF Protection**: SameSite cookies + CSRF tokens for state-changing operations
- **Sensitive Data**: Never store tokens in localStorage (use httpOnly cookies)
- **Input Sanitization**: Sanitize any user input before display

### Infrastructure Security
- **Docker Security**: Non-root user in containers, minimal base images
- **Network Isolation**: Database not exposed to public network
- **Secrets Management**: Use Docker secrets or environment files
- **Regular Updates**: Keep dependencies updated for security patches

### Monitoring & Logging
- **Audit Logging**: Log authentication events and sensitive operations
- **Error Handling**: Generic error messages to users, detailed logs server-side
- **No Sensitive Data in Logs**: Never log passwords, tokens, or financial details

---

## Project Structure

```
business-finance/
├── src/
│   ├── client/              # React frontend
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks (TanStack Query)
│   │   ├── api/             # API client (fetch wrapper)
│   │   └── types/           # Frontend-specific types
│   ├── server/              # Fastify backend
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── db/              # Drizzle schema & migrations
│   │   ├── auth/            # Authentication logic
│   │   └── utils/           # Helpers
│   └── shared/              # Shared types between frontend/backend
│       └── types.ts
├── docker-compose.yml
├── Dockerfile
├── vite.config.ts
├── drizzle.config.ts
└── package.json
```

---

## Database Schema

### Core Tables

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| email | varchar(255) | Unique, indexed |
| password_hash | varchar(255) | bcrypt hash, nullable (passkey-only users) |
| created_at | timestamp | |
| updated_at | timestamp | |

**passkeys** (WebAuthn credentials)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key |
| credential_id | bytea | Unique, WebAuthn credential ID |
| public_key | bytea | COSE public key |
| counter | bigint | Signature counter (replay protection) |
| device_name | varchar(255) | User-friendly name (e.g., "MacBook Pro") |
| transports | varchar[] | Array: usb, nfc, ble, internal, hybrid |
| created_at | timestamp | |
| last_used_at | timestamp | |

**invoices** (Chiffre d'affaire)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key, indexed |
| client | varchar(255) | |
| description | text | |
| invoice_date | date | |
| payment_date | date | Nullable |
| amount_ht | decimal(12,2) | Amount without tax |
| tax_rate | decimal(5,2) | e.g., 20.00 for 20% |
| amount_ttc | decimal(12,2) | Amount with tax |
| invoice_number | varchar(50) | |
| note | text | Nullable |
| created_at | timestamp | |

**expenses** (Business expenses - unified)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key, indexed |
| description | varchar(255) | |
| date | date | |
| amount_ht | decimal(12,2) | |
| tax_amount | decimal(12,2) | |
| tax_recovery_rate | decimal(5,2) | 80 or 100 |
| category | varchar(50) | fixed, one-time, etc. |
| is_recurring | boolean | |
| recurrence_period | varchar(20) | monthly, yearly, null |
| note | text | Nullable |
| created_at | timestamp | |

**tax_payments** (TVA payments)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key |
| status | varchar(20) | pending, paid |
| amount | decimal(12,2) | |
| reference | varchar(100) | |
| payment_date | date | Nullable |
| note | text | Nullable |
| period_start | date | |
| period_end | date | |

**urssaf_payments**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key |
| trimester | int | 1-4 |
| year | int | |
| revenue | decimal(12,2) | |
| amount | decimal(12,2) | |
| status | varchar(20) | pending, paid |
| payment_date | date | Nullable |
| reference | varchar(100) | |
| note | text | Nullable |

**income_tax_payments** (Impots)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key |
| year | int | |
| amount | decimal(12,2) | |
| status | varchar(20) | pending, paid |
| payment_date | date | Nullable |
| reference | varchar(100) | |
| note | text | Nullable |

**settings** (Base configuration)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key, unique |
| urssaf_rate | decimal(5,2) | e.g., 22.00 |
| estimated_tax_rate | decimal(5,2) | |
| revenue_deduction_rate | decimal(5,2) | For taxable income calc |
| monthly_salary | decimal(12,2) | |
| created_at | timestamp | |
| updated_at | timestamp | |

**tax_brackets**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key, nullable (null = official) |
| year | int | |
| min_income | decimal(12,2) | |
| max_income | decimal(12,2) | Nullable for top bracket |
| rate | decimal(5,2) | |
| is_custom | boolean | |

---

## Features & Pages

### 1. Dashboard (Tableau de bord)
- Current month overview: revenue, taxes owed, Urssaf owed, net remaining
- Quick access to key metrics
- Alerts for upcoming payments

### 2. Invoices (Chiffre d'affaire)
- List all invoices with filtering (by month, client, status)
- Add/edit/delete invoices
- Monthly summary view: revenue, tax total, Urssaf, impots, remaining
- Invoice number auto-generation

### 3. Expenses (Depenses)
- Unified expense management (replaces scattered expense tracking)
- Categories: fixed monthly, one-time, tax-deductible
- Mark recurring expenses (insurance, health insurance)
- Track tax recovery eligibility (80% vs 100%)

### 4. TVA (Taxes)
- Overview: taxes collected vs taxes to recover
- Monthly breakdown
- Record tax payments with status tracking
- Calculate net TVA owed

### 5. Urssaf
- Quarterly view of revenue and Urssaf amounts
- Payment tracking with status
- Annual overview
- Auto-calculate based on configured rate

### 6. Business Account (Compte entreprise)
- Enter current balance
- Show pending obligations (unpaid Urssaf, TVA, etc.)
- Reserve for next month salary
- Display available funds

### 7. Income Tax (Impots)
- Estimate personal income tax from business revenue
- Use official French tax brackets (with manual override option)
- Track current tax obligations
- Support custom adjustments

### 8. Calculator (Calcul prestation)
- Quick calculation tool
- Input amount HT or TTC
- Show: Urssaf deduction, estimated tax, net remaining
- Useful for quoting clients

### 9. Settings (Configuration)
- Urssaf rate configuration
- Estimated tax rate for year
- Revenue deduction rate for tax calculation
- Monthly salary amount
- Tax bracket management (view official, add custom overrides)
- Recurring expense management

---

## Implementation Phases

### Phase 1: Project Setup [COMPLETE]
1. ~~Initialize npm project with TypeScript~~
2. ~~Setup React frontend with Vite + TailwindCSS + DaisyUI~~
3. ~~Setup Fastify API with TypeScript~~
4. ~~Configure PostgreSQL with Docker~~
5. ~~Setup Drizzle ORM with initial schema~~
6. ~~Configure TanStack Query for data fetching~~
7. ~~**Security**: Configure Helmet.js, CORS, rate limiting~~

### Phase 2: Authentication [COMPLETE]
1. ~~Implement user registration/login API (email + password)~~
2. ~~JWT token generation and validation~~
3. ~~Password hashing with bcrypt (cost factor 12)~~
4. ~~Protected route middleware~~
5. ~~Frontend auth context and login/register pages~~
6. ~~**Passkey Integration (WebAuthn)**:~~
   - ~~Install @simplewebauthn/server and @simplewebauthn/browser~~
   - ~~Registration flow: generate challenge, verify attestation, store credential~~
   - ~~Authentication flow: generate challenge, verify assertion~~
   - ~~Manage passkeys page (view, rename, delete registered passkeys)~~
7. ~~**Security**: HTTP-only cookies, CSRF protection, rate limiting on auth endpoints~~

**Files created in Phase 2:**
- `src/server/auth/jwt.ts` - JWT utilities
- `src/server/auth/password.ts` - bcrypt password hashing
- `src/server/auth/middleware.ts` - requireAuth middleware
- `src/server/auth/webauthn.ts` - WebAuthn utilities
- `src/server/routes/auth.ts` - Auth API routes
- `src/server/routes/passkeys.ts` - Passkey API routes
- `src/client/contexts/AuthContext.tsx` - Auth state management
- `src/client/components/ProtectedRoute.tsx` - Route protection
- `src/client/utils/passkey.ts` - Browser passkey helpers
- `src/client/pages/Register.tsx` - Registration page
- `src/client/pages/ManagePasskeys.tsx` - Passkey management

### Phase 3: Core Data Models [COMPLETE]
1. ~~Create all Drizzle schemas (already done in Phase 1)~~
2. ~~Setup database migrations~~
3. ~~Implement CRUD API routes for:~~
   - ~~Invoices (CRUD + monthly summary)~~
   - ~~Expenses (CRUD + monthly summary + recurring expenses)~~
   - ~~Settings (user settings + tax brackets + tax calculation)~~
4. ~~Frontend API client setup (already done)~~
5. ~~**Security**: Input validation with Zod, user_id filtering on all queries~~

**Files created in Phase 3:**
- `src/server/routes/invoices.ts` - Invoice CRUD API routes
- `src/server/routes/expenses.ts` - Expense CRUD API routes
- `src/server/routes/settings.ts` - Settings and tax bracket API routes

**API Endpoints added:**
- `GET/POST /api/invoices` - List/create invoices
- `GET/PUT/DELETE /api/invoices/:id` - Get/update/delete invoice
- `GET /api/invoices/summary/monthly` - Monthly invoice summary
- `GET/POST /api/expenses` - List/create expenses
- `GET/PUT/DELETE /api/expenses/:id` - Get/update/delete expense
- `GET /api/expenses/summary/monthly` - Monthly expense summary
- `GET /api/expenses/recurring` - List recurring expenses
- `GET/PUT /api/settings` - Get/update user settings
- `GET/POST/DELETE /api/settings/tax-brackets` - Manage tax brackets
- `POST /api/settings/calculate-tax` - Calculate estimated income tax

### Phase 4: Invoice Management [COMPLETE]
1. ~~Invoice list page with filters (by month and client)~~
2. ~~Add/edit invoice form (modal with full CRUD)~~
3. ~~Monthly summary calculations (CA HT, TVA, Urssaf, Impôts estimés, Restant)~~
4. ~~Invoice number auto-generation (FAC-YYYYMM-XXX format)~~

**Files created in Phase 4:**
- `src/client/hooks/useInvoices.ts` - Invoice CRUD hooks with TanStack Query
- `src/client/hooks/useSettings.ts` - Settings hooks for Urssaf/tax rates
- `src/client/pages/Invoices.tsx` - Full invoice management UI

**Features implemented:**
- Invoice list with month and client filtering
- Create/Edit/Delete invoices via modal form
- Monthly summary with CA HT, CA TTC, TVA collected, Urssaf, estimated taxes, remaining amount
- Auto-generation of invoice numbers (FAC-YYYYMM-XXX format)
- Real-time TTC calculation in form
- Payment status tracking (paid/pending)

### Phase 5: Expense Management
1. Unified expense interface
2. Recurring expense support
3. Tax recovery tracking
4. Category management

### Phase 6: Tax & Contributions
1. TVA calculation and tracking
2. Urssaf quarterly management
3. Payment status tracking
4. Auto-calculations based on settings

### Phase 7: Financial Overview
1. Dashboard with key metrics
2. Business account overview
3. Available funds calculation
4. Pending obligations display

### Phase 8: Income Tax
1. French tax bracket integration (official 2024/2025 rates)
2. Custom bracket override
3. Tax estimation calculator
4. Annual tax tracking

### Phase 9: Calculator Tool
1. Quick prestation calculator
2. HT/TTC conversion
3. Net amount after deductions

### Phase 10: Polish & Deployment
1. French translations (UI labels)
2. Error handling and validation
3. Docker production build
4. Docker Compose for self-hosting
5. **Security**: SSL/TLS setup, security audit, penetration testing

---

## Key Calculations

### Monthly Summary (from Chiffre d'affaire)
```
Revenue = sum(invoice.amount_ht) for month
Tax Total = sum(invoice.amount_ttc - invoice.amount_ht) for month
Urssaf = Revenue * urssaf_rate
Impots (estimated) = Revenue * estimated_tax_rate
Remaining = Revenue - Urssaf - Impots
```

### TVA Owed
```
TVA Collected = sum(invoice taxes) for period
TVA Recoverable = sum(expense.tax_amount * expense.tax_recovery_rate) for period
Net TVA = TVA Collected - TVA Recoverable
```

### Business Account Available
```
Available = Current Balance - Unpaid Urssaf - Unpaid TVA - Next Month Salary
```

### Income Tax Estimation
```
Taxable Income = Annual Revenue * (1 - revenue_deduction_rate)
Tax = apply progressive brackets to Taxable Income
```

---

## French Tax Brackets (2024 - to be updated yearly)
| Bracket | Income Range | Rate |
|---------|--------------|------|
| 1 | 0 - 11,294 EUR | 0% |
| 2 | 11,295 - 28,797 EUR | 11% |
| 3 | 28,798 - 82,341 EUR | 30% |
| 4 | 82,342 - 177,106 EUR | 41% |
| 5 | > 177,106 EUR | 45% |

*App will include these as defaults with ability to override*

---

## Files to Create (Initial)

### Backend (src/server/)
- `src/server/index.ts` - Fastify server setup with security middleware
- `src/server/db/schema.ts` - Drizzle schema definitions
- `src/server/db/index.ts` - Database connection
- `src/server/routes/auth.ts` - Auth routes (login, register, logout)
- `src/server/routes/passkeys.ts` - WebAuthn routes (register, authenticate, manage)
- `src/server/routes/invoices.ts` - Invoice CRUD
- `src/server/routes/expenses.ts` - Expense CRUD
- `src/server/routes/settings.ts` - Settings management
- `src/server/routes/calculations.ts` - Tax/Urssaf calculations
- `src/server/auth/jwt.ts` - JWT utilities
- `src/server/auth/webauthn.ts` - WebAuthn challenge generation and verification
- `src/server/auth/middleware.ts` - Auth middleware
- `src/server/middleware/security.ts` - Rate limiting, validation

### Frontend (src/client/)
- `src/client/App.tsx` - Main app with routing
- `src/client/main.tsx` - Entry point with TanStack Query provider
- `src/client/pages/Dashboard.tsx`
- `src/client/pages/Invoices.tsx`
- `src/client/pages/Expenses.tsx`
- `src/client/pages/TVA.tsx`
- `src/client/pages/Urssaf.tsx`
- `src/client/pages/BusinessAccount.tsx`
- `src/client/pages/IncomeTax.tsx`
- `src/client/pages/Calculator.tsx`
- `src/client/pages/Settings.tsx`
- `src/client/pages/Login.tsx`
- `src/client/pages/ManagePasskeys.tsx` - View/add/remove passkeys
- `src/client/components/Layout.tsx`
- `src/client/components/PasskeyButton.tsx` - Passkey login/register button
- `src/client/components/Sidebar.tsx`
- `src/client/api/client.ts` - API client
- `src/client/hooks/useAuth.ts` - Auth hook with TanStack Query

### Shared (src/shared/)
- `src/shared/types.ts` - Shared TypeScript types
- `src/shared/validation.ts` - Shared Zod schemas

### Root
- `docker-compose.yml` - PostgreSQL + app services
- `docker-compose.prod.yml` - Production configuration with SSL
- `Dockerfile` - Production build (non-root user)
- `vite.config.ts` - Vite configuration
- `drizzle.config.ts` - Drizzle configuration
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variables template (no secrets)
- `.gitignore` - Exclude .env, node_modules, etc.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/business_finance

# JWT
JWT_SECRET=your-very-long-random-secret-key-here
JWT_REFRESH_SECRET=another-very-long-random-secret-key

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# WebAuthn (Passkeys)
WEBAUTHN_RP_ID=your-domain.com
WEBAUTHN_RP_NAME=Business Finance Tracker
WEBAUTHN_ORIGIN=https://your-domain.com
```

---

## Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] SSL/TLS certificates configured (required for passkeys)
- [ ] CORS origin set to production domain
- [ ] WebAuthn RP ID matches production domain
- [ ] Rate limiting enabled
- [ ] Database backups configured
- [ ] Monitoring/logging setup
- [ ] Security headers verified (use securityheaders.com)
- [ ] Default tax brackets seeded in database
- [ ] Test passkey registration and authentication
