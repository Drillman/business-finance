import { pgTable, uuid, varchar, text, timestamp, decimal, date, boolean, integer, index } from 'drizzle-orm/pg-core'

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('users_email_idx').on(table.email),
])

// Passkeys (WebAuthn credentials)
export const passkeys = pgTable('passkeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceName: varchar('device_name', { length: 255 }),
  transports: text('transports'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => [
  index('passkeys_user_id_idx').on(table.userId),
  index('passkeys_credential_id_idx').on(table.credentialId),
])

// Invoices (Chiffre d'affaire)
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client: varchar('client', { length: 255 }).notNull(),
  description: text('description'),
  invoiceDate: date('invoice_date').notNull(),
  paymentDate: date('payment_date'),
  amountHt: decimal('amount_ht', { precision: 12, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull(),
  amountTtc: decimal('amount_ttc', { precision: 12, scale: 2 }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  note: text('note'),
  isCanceled: boolean('is_canceled').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('invoices_user_id_idx').on(table.userId),
  index('invoices_payment_date_idx').on(table.paymentDate),
])

// Expenses (Dépenses)
export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 255 }).notNull(),
  date: date('date').notNull(),
  amountHt: decimal('amount_ht', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRecoveryRate: decimal('tax_recovery_rate', { precision: 5, scale: 2 }).notNull().default('100'),
  category: varchar('category', { length: 50 }).notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurrencePeriod: varchar('recurrence_period', { length: 20 }),
  startMonth: date('start_month'),
  endMonth: date('end_month'),
  paymentDay: integer('payment_day'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('expenses_user_id_idx').on(table.userId),
  index('expenses_date_idx').on(table.date),
])

// Tax payments (TVA)
export const taxPayments = pgTable('tax_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 100 }),
  paymentDate: date('payment_date'),
  note: text('note'),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('tax_payments_user_id_idx').on(table.userId),
])

// URSSAF payments
export const urssafPayments = pgTable('urssaf_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trimester: integer('trimester').notNull(),
  year: integer('year').notNull(),
  revenue: decimal('revenue', { precision: 12, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  paymentDate: date('payment_date'),
  reference: varchar('reference', { length: 100 }),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('urssaf_payments_user_id_idx').on(table.userId),
])

// Income tax payments (Impôts)
export const incomeTaxPayments = pgTable('income_tax_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  paymentDate: date('payment_date'),
  reference: varchar('reference', { length: 100 }),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('income_tax_payments_user_id_idx').on(table.userId),
])

// User settings
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  urssafRate: decimal('urssaf_rate', { precision: 5, scale: 2 }).notNull().default('22.00'),
  estimatedTaxRate: decimal('estimated_tax_rate', { precision: 5, scale: 2 }).notNull().default('11.00'),
  revenueDeductionRate: decimal('revenue_deduction_rate', { precision: 5, scale: 2 }).notNull().default('34.00'),
  monthlySalary: decimal('monthly_salary', { precision: 12, scale: 2 }).notNull().default('3000.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Tax brackets
export const taxBrackets = pgTable('tax_brackets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  minIncome: decimal('min_income', { precision: 12, scale: 2 }).notNull(),
  maxIncome: decimal('max_income', { precision: 12, scale: 2 }),
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(),
  isCustom: boolean('is_custom').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('tax_brackets_year_idx').on(table.year),
])

// Business account balance
export const accountBalances = pgTable('account_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  balance: decimal('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Refresh tokens for JWT auth
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('refresh_tokens_user_id_idx').on(table.userId),
  index('refresh_tokens_token_idx').on(table.token),
])

// Invoice clients (for autocomplete)
export const invoiceClients = pgTable('invoice_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('invoice_clients_user_id_idx').on(table.userId),
])

// Invoice descriptions (for autocomplete)
export const invoiceDescriptions = pgTable('invoice_descriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('invoice_descriptions_user_id_idx').on(table.userId),
])
