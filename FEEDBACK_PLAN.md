# Feedback Implementation Plan

This document outlines the plan to implement all feedback items from `Feebacks.md`.

---

## Phase 11: Global UI Improvements

### 11.1 Button Styling
- [ ] Update DaisyUI/Tailwind config to use more rounded buttons by default (`btn-rounded` or custom `border-radius`)
- [ ] Audit all button components for consistency

### 11.2 Form Label Alignment
- [ ] Audit all forms across the application
- [ ] Ensure all input labels are positioned above their respective fields (vertical layout)
- [ ] Update form components in `src/client/components/` if needed

### 11.3 Collapsible Sidebar
- [ ] Add collapse/expand toggle button to sidebar
- [ ] Implement collapsed state showing only icons
- [ ] Reduce expanded sidebar width slightly
- [ ] Store collapse preference in localStorage

### 11.4 Table Action Buttons
- [ ] Replace text-based "Modifier"/"Supprimer" buttons with icon buttons
- [ ] Use consistent icons (e.g., pencil for edit, trash for delete)
- [ ] Apply to all data tables (invoices, expenses, TVA, Urssaf, income tax)

---

## Phase 12: Invoice Page Enhancements

### 12.1 Page Rename
- [ ] Rename page title from current name to "Factures"
- [ ] Update navigation/sidebar label

### 12.2 Timeline Layout
- [ ] Redesign invoice list as a yearly timeline
- [ ] Group invoices by month with month headers
- [ ] Update KPIs to show year-to-date totals instead of monthly

### 12.3 List Refresh on Actions
- [ ] Ensure TanStack Query invalidates invoice list on:
  - Invoice creation
  - Invoice modification
  - Invoice deletion
- [ ] Verify `useMutation` hooks have proper `onSuccess` invalidation

### 12.4 Payment Status Quick Action
- [ ] Add action button for invoices with "pending" payment status
- [ ] Create popup/modal for:
  - Selecting payment date
  - Changing status to "paid"
- [ ] Update invoice via API on submission

### 12.5 Auto-Generated Invoice Numbers
- [ ] Implement invoice number format: `yyyymmxx`
  - `yyyy` = current year
  - `mm` = invoice creation month
  - `xx` = sequential number for the year (01-99)
- [ ] Create API endpoint or modify existing to fetch latest invoice number
- [ ] Auto-fill new invoice form with next sequential number
- [ ] Example: After `20250102`, next January invoice = `20250103`

### 12.6 Client Dropdown
- [ ] Add `clients` table to database schema
  - Fields: `id`, `userId`, `name`, `createdAt`
- [ ] Create CRUD API routes for clients (`/api/clients`)
- [ ] Add client management UI in Settings page
- [ ] Replace text input with dropdown in invoice form
- [ ] Allow selecting from existing clients

### 12.7 Description Dropdown with Custom Input
- [ ] Add `invoiceDescriptions` table to database schema
  - Fields: `id`, `userId`, `description`, `createdAt`
- [ ] Create CRUD API routes for descriptions (`/api/invoice-descriptions`)
- [ ] Add description management UI in Settings page
- [ ] Replace text input with combobox (dropdown + free text input)
- [ ] Allow selecting existing or typing new description

---

## Phase 13: Expense Page Fixes & Enhancements

### 13.1 Delete Expense Bug Fix
- [ ] Investigate and fix the error when deleting an expense
- [ ] Check API route, database constraints, and frontend mutation

### 13.2 Tax-Inclusive Price Input
- [ ] Modify expense form to input TTC (tax-inclusive) amount
- [ ] Add tax percentage dropdown with French rates:
  - 20% (default - standard rate)
  - 10% (reduced rate)
  - 5.5% (reduced rate - food, books, etc.)
  - 2.1% (super-reduced rate - press, medicines)
- [ ] Auto-calculate HT (tax-exclusive) amount from TTC and selected rate
- [ ] Store both HT and TTC in database (or calculate on display)

### 13.3 Fixed/Recurring Expenses Subpage
- [ ] Create new subpage for recurring expenses (e.g., `/expenses/recurring`)
- [ ] Add `recurringExpenses` table to database schema:
  - Fields: `id`, `userId`, `description`, `amount`, `category`, `startMonth`, `endMonth`, `createdAt`
  - Default: January to December of current year
- [ ] Create CRUD API routes for recurring expenses
- [ ] Build UI for managing recurring expenses
- [ ] Auto-generate monthly expense entries from recurring definitions
- [ ] Display generated recurring expenses in a separate section at top of expenses list

### 13.4 Remove Category Tags
- [ ] Remove the category amount summary tags/badges from expense list
- [ ] Simplify the expense list view

---

## Implementation Order (Suggested)

1. **Phase 11** - Global UI (affects all pages, do first)
2. **Phase 13.1** - Fix delete expense bug (quick fix)
3. **Phase 12.1-12.3** - Basic invoice improvements
4. **Phase 12.4** - Payment status action
5. **Phase 12.5** - Invoice number generation
6. **Phase 13.2** - Tax-inclusive expense input
7. **Phase 12.6** - Client dropdown (requires Settings UI)
8. **Phase 12.7** - Description dropdown (requires Settings UI)
9. **Phase 13.3** - Recurring expenses (largest feature)
10. **Phase 13.4** - Remove category tags

---

## Database Schema Changes Required

```sql
-- Clients table
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invoice descriptions table
CREATE TABLE invoice_descriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recurring expenses table
CREATE TABLE recurring_expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(100),
  start_month DATE NOT NULL,
  end_month DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- May need to add TTC amount to expenses table
ALTER TABLE expenses ADD COLUMN amount_ttc DECIMAL(12,2);
ALTER TABLE expenses ADD COLUMN tax_rate DECIMAL(4,2) DEFAULT 20.00;
```

---

## New API Routes Required

- `GET/POST /api/clients` - List and create clients
- `PUT/DELETE /api/clients/:id` - Update and delete clients
- `GET/POST /api/invoice-descriptions` - List and create descriptions
- `DELETE /api/invoice-descriptions/:id` - Delete descriptions
- `GET /api/invoices/next-number` - Get next invoice number
- `GET/POST /api/expenses/recurring` - List and create recurring expenses
- `PUT/DELETE /api/expenses/recurring/:id` - Update and delete recurring expenses

---

## Settings Page Additions

- Client management section
- Invoice description management section
- (Recurring expenses has its own subpage)
