// User types
export interface User {
  id: string
  email: string
  createdAt: string
  updatedAt: string
}

// Invoice types
export interface Invoice {
  id: string
  userId: string
  client: string
  description: string | null
  invoiceDate: string
  paymentDate: string | null
  amountHt: string
  taxRate: string
  amountTtc: string
  invoiceNumber: string | null
  note: string | null
  createdAt: string
}

export interface CreateInvoiceInput {
  client: string
  description?: string
  invoiceDate: string
  paymentDate?: string
  amountHt: number
  taxRate: number
  invoiceNumber?: string
  note?: string
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>

// Expense types
export interface Expense {
  id: string
  userId: string
  description: string
  date: string
  amountHt: string
  taxAmount: string
  taxRecoveryRate: string
  category: string
  isRecurring: boolean
  recurrencePeriod: string | null
  startMonth: string | null
  endMonth: string | null
  paymentDay: number | null
  note: string | null
  createdAt: string
}

export type ExpenseCategory = 'fixed' | 'one-time' | 'recurring' | 'professional' | 'other'
export type RecurrencePeriod = 'monthly' | 'quarterly' | 'yearly'

export interface CreateExpenseInput {
  description: string
  date: string
  amountHt: number
  taxAmount?: number
  taxRecoveryRate?: number
  category: ExpenseCategory
  isRecurring?: boolean
  recurrencePeriod?: RecurrencePeriod
  startMonth?: string
  endMonth?: string
  paymentDay?: number
  note?: string
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>

// Tax payment types
export interface TaxPayment {
  id: string
  userId: string
  status: 'pending' | 'paid'
  amount: string
  reference: string | null
  paymentDate: string | null
  note: string | null
  periodStart: string
  periodEnd: string
  createdAt: string
}

export interface CreateTaxPaymentInput {
  amount: number
  periodStart: string
  periodEnd: string
  status?: 'pending' | 'paid'
  paymentDate?: string
  reference?: string
  note?: string
}

export type UpdateTaxPaymentInput = Partial<CreateTaxPaymentInput>

// URSSAF payment types
export interface UrssafPayment {
  id: string
  userId: string
  trimester: number
  year: number
  revenue: string
  amount: string
  status: 'pending' | 'paid'
  paymentDate: string | null
  reference: string | null
  note: string | null
  createdAt: string
}

export interface CreateUrssafPaymentInput {
  trimester: number
  year: number
  revenue: number
  amount: number
  status?: 'pending' | 'paid'
  paymentDate?: string
  reference?: string
  note?: string
}

export type UpdateUrssafPaymentInput = Partial<CreateUrssafPaymentInput>

// Income tax payment types
export interface IncomeTaxPayment {
  id: string
  userId: string
  year: number
  amount: string
  status: 'pending' | 'paid'
  paymentDate: string | null
  reference: string | null
  note: string | null
  createdAt: string
}

export interface CreateIncomeTaxPaymentInput {
  year: number
  amount: number
  status?: 'pending' | 'paid'
  paymentDate?: string
  reference?: string
  note?: string
}

export type UpdateIncomeTaxPaymentInput = Partial<CreateIncomeTaxPaymentInput>

// Income tax summary types
export interface IncomeTaxSummary {
  year: number
  estimatedTax: string
  taxableIncome: string
  totalRevenue: string
  deductionRate: string
  totalPaid: string
  totalPending: string
  remaining: string
  brackets: TaxBracketBreakdown[]
}

export interface TaxBracketBreakdown {
  minIncome: string
  maxIncome: string | null
  rate: string
  taxableAmount: string
  taxAmount: string
}

// Settings types
export interface Settings {
  id: string
  userId: string
  urssafRate: string
  estimatedTaxRate: string
  revenueDeductionRate: string
  monthlySalary: string
  createdAt: string
  updatedAt: string
}

export interface UpdateSettingsInput {
  urssafRate?: number
  estimatedTaxRate?: number
  revenueDeductionRate?: number
  monthlySalary?: number
}

// Tax bracket types
export interface TaxBracket {
  id: string
  userId: string | null
  year: number
  minIncome: string
  maxIncome: string | null
  rate: string
  isCustom: boolean
  createdAt: string
}

// Auth types
export interface AuthResponse {
  user: User
  accessToken: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
}

// Passkey types
export interface Passkey {
  id: string
  deviceName: string | null
  createdAt: string
  lastUsedAt: string | null
}

// API response types
export interface ApiError {
  message: string
  code?: string
}

// Monthly summary type
export interface MonthlySummary {
  month: string
  year: number
  revenue: number
  taxTotal: number
  urssafAmount: number
  estimatedIncomeTax: number
  remaining: number
}

// Business account types
export interface AccountBalance {
  id: string
  userId: string
  balance: string
  updatedAt: string
}

export interface AccountSummary {
  currentBalance: string
  pendingTva: string
  pendingUrssaf: string
  pendingIncomeTax: string
  totalObligations: string
  nextMonthSalary: string
  availableFunds: string
}

// Dashboard types
export interface DashboardSummary {
  month: number
  year: number
  revenueHt: string
  revenueTtc: string
  tvaCollected: string
  tvaRecoverable: string
  netTva: string
  urssafEstimate: string
  incomeTaxEstimate: string
  expensesHt: string
  netRemaining: string
  pendingTva: string
  pendingUrssaf: string
  upcomingPayments: UpcomingPayment[]
}

export interface UpcomingPayment {
  type: 'tva' | 'urssaf' | 'income_tax'
  amount: string
  dueDate?: string
  description: string
}
