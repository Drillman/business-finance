import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, gte, lte, notInArray, inArray } from 'drizzle-orm'
import { db } from '../db'
import { accountBalances, taxPayments, urssafPayments, incomeTaxPayments, settings, invoices, expenses } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const updateBalanceSchema = z.object({
  balance: z.number().min(0, 'Le solde ne peut pas être négatif'),
})

export async function accountRoutes(fastify: FastifyInstance) {
  // Get current balance
  fastify.get(
    '/api/account/balance',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.authUser.userId

      let balance = await db.query.accountBalances.findFirst({
        where: eq(accountBalances.userId, userId),
      })

      // Create default balance if none exists
      if (!balance) {
        const [newBalance] = await db
          .insert(accountBalances)
          .values({ userId, balance: '0' })
          .returning()
        balance = newBalance
      }

      return balance
    }
  )

  // Update balance
  fastify.put(
    '/api/account/balance',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateBalanceSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { balance } = parseResult.data
      const userId = request.authUser.userId

      // Check if balance record exists
      const existing = await db.query.accountBalances.findFirst({
        where: eq(accountBalances.userId, userId),
      })

      if (existing) {
        const [updated] = await db
          .update(accountBalances)
          .set({
            balance: balance.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(accountBalances.userId, userId))
          .returning()
        return updated
      } else {
        const [created] = await db
          .insert(accountBalances)
          .values({
            userId,
            balance: balance.toFixed(2),
          })
          .returning()
        return created
      }
    }
  )

  // Get account summary with all obligations
  fastify.get(
    '/api/account/summary',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.authUser.userId
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      // Get current balance
      let balanceRecord = await db.query.accountBalances.findFirst({
        where: eq(accountBalances.userId, userId),
      })

      if (!balanceRecord) {
        const [newBalance] = await db
          .insert(accountBalances)
          .values({ userId, balance: '0' })
          .returning()
        balanceRecord = newBalance
      }

      const currentBalance = parseFloat(balanceRecord.balance)

      // Get user settings
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })
      const monthlySalary = userSettings ? parseFloat(userSettings.monthlySalary) : 3000
      const urssafRate = userSettings ? parseFloat(userSettings.urssafRate) : 22
      const taxRate = userSettings ? parseFloat(userSettings.estimatedTaxRate) : 11

      // Get pending TVA
      const pendingTvaResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${taxPayments.amount}::numeric), 0)`,
        })
        .from(taxPayments)
        .where(
          and(
            eq(taxPayments.userId, userId),
            eq(taxPayments.status, 'pending')
          )
        )
      const pendingTva = parseFloat(pendingTvaResult[0].total)

      // Get pending Urssaf
      const pendingUrssafResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${urssafPayments.amount}::numeric), 0)`,
        })
        .from(urssafPayments)
        .where(
          and(
            eq(urssafPayments.userId, userId),
            eq(urssafPayments.status, 'pending')
          )
        )
      const pendingUrssaf = parseFloat(pendingUrssafResult[0].total)

      // Get pending income tax
      const pendingIncomeTaxResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${incomeTaxPayments.amount}::numeric), 0)`,
        })
        .from(incomeTaxPayments)
        .where(
          and(
            eq(incomeTaxPayments.userId, userId),
            eq(incomeTaxPayments.status, 'pending')
          )
        )
      const pendingIncomeTax = parseFloat(pendingIncomeTaxResult[0].total)

      // Get all declared TVA period months (pending or paid)
      const declaredTvaMonths = await db
        .select({ periodMonth: taxPayments.periodMonth })
        .from(taxPayments)
        .where(eq(taxPayments.userId, userId))
      const declaredTvaMonthSet = new Set(declaredTvaMonths.map(t => t.periodMonth))

      // Get all declared Urssaf trimesters (pending or paid)
      const declaredUrssafTrimesters = await db
        .select({ trimester: urssafPayments.trimester, year: urssafPayments.year })
        .from(urssafPayments)
        .where(eq(urssafPayments.userId, userId))
      const declaredUrssafSet = new Set(
        declaredUrssafTrimesters.map(u => `${u.year}-T${u.trimester}`)
      )

      const previousYear = currentYear - 1

      // Helper function to calculate TVA for a specific month
      // This matches the logic in tva.ts /api/tva/monthly route
      const calculateTvaForMonth = async (month: number, year: number) => {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

        // Get invoice totals for this month
        const invoiceResult = await db
          .select({
            totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
            totalTtc: sql<string>`COALESCE(SUM(${invoices.amountTtc}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.userId, userId),
              eq(invoices.isCanceled, false),
              gte(invoices.paymentDate, startDate),
              lte(invoices.paymentDate, endDate)
            )
          )

        const revenueHt = parseFloat(invoiceResult[0].totalHt)
        const revenueTtc = parseFloat(invoiceResult[0].totalTtc)
        const tvaCollected = revenueTtc - revenueHt

        // Get non-recurring expense TVA for this month
        const nonRecurringResult = await db
          .select({
            recoverableTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric * ${expenses.taxRecoveryRate}::numeric / 100), 0)`,
          })
          .from(expenses)
          .where(
            and(
              eq(expenses.userId, userId),
              eq(expenses.isRecurring, false),
              gte(expenses.date, startDate),
              lte(expenses.date, endDate)
            )
          )

        // Get recurring expenses for this specific month (matching tva.ts logic exactly)
        const monthRecurringExpenses = await db
          .select({
            taxAmount: expenses.taxAmount,
            taxRecoveryRate: expenses.taxRecoveryRate,
            startMonth: expenses.startMonth,
            recurrencePeriod: expenses.recurrencePeriod,
          })
          .from(expenses)
          .where(
            and(
              eq(expenses.userId, userId),
              eq(expenses.isRecurring, true),
              lte(expenses.startMonth, startDate),
              sql`(${expenses.endMonth} IS NULL OR ${expenses.endMonth} >= ${startDate})`
            )
          )

        // Calculate recurring TVA based on recurrence period
        let recurringTax = 0
        for (const expense of monthRecurringExpenses) {
          const expenseStartMonth = new Date(expense.startMonth!).getMonth()
          const currentMonthIndex = month - 1 // JavaScript months are 0-indexed

          let shouldInclude = false
          if (expense.recurrencePeriod === 'monthly') {
            shouldInclude = true
          } else if (expense.recurrencePeriod === 'quarterly') {
            shouldInclude = (currentMonthIndex - expenseStartMonth + 12) % 3 === 0
          } else if (expense.recurrencePeriod === 'yearly') {
            shouldInclude = currentMonthIndex === expenseStartMonth
          }

          if (shouldInclude) {
            const taxAmount = parseFloat(expense.taxAmount || '0')
            const recoveryRate = parseFloat(expense.taxRecoveryRate || '100')
            recurringTax += taxAmount * recoveryRate / 100
          }
        }

        const nonRecurringTvaRecoverable = parseFloat(nonRecurringResult[0].recoverableTax)
        const tvaRecoverable = nonRecurringTvaRecoverable + recurringTax
        return tvaCollected - tvaRecoverable
      }

      // Helper function to calculate Urssaf for a specific trimester
      const calculateUrssafForTrimester = async (trimester: number, year: number, maxMonth?: number) => {
        const startMonth = (trimester - 1) * 3 + 1
        const endMonth = maxMonth !== undefined ? Math.min(trimester * 3, maxMonth) : trimester * 3

        const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`
        const lastDay = new Date(year, endMonth, 0).getDate()
        const endDate = `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

        const invoiceResult = await db
          .select({
            totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.userId, userId),
              eq(invoices.isCanceled, false),
              gte(invoices.paymentDate, startDate),
              lte(invoices.paymentDate, endDate)
            )
          )

        return parseFloat(invoiceResult[0].totalHt) * (urssafRate / 100)
      }

      // Calculate estimated TVA for undeclared months (previous year + current year)
      let estimatedTva = 0

      // Check previous year (all 12 months)
      for (let month = 1; month <= 12; month++) {
        const periodMonth = `${previousYear}-${month.toString().padStart(2, '0')}`
        if (declaredTvaMonthSet.has(periodMonth)) continue

        const netTva = await calculateTvaForMonth(month, previousYear)
        if (netTva > 0) {
          estimatedTva += netTva
        }
      }

      // Check current year (up to current month)
      for (let month = 1; month <= currentMonth; month++) {
        const periodMonth = `${currentYear}-${month.toString().padStart(2, '0')}`
        if (declaredTvaMonthSet.has(periodMonth)) continue

        const netTva = await calculateTvaForMonth(month, currentYear)
        if (netTva > 0) {
          estimatedTva += netTva
        }
      }

      // Calculate estimated Urssaf for undeclared trimesters (previous year + current year)
      let estimatedUrssaf = 0

      // Check previous year (all 4 trimesters)
      for (let trimester = 1; trimester <= 4; trimester++) {
        const trimesterKey = `${previousYear}-T${trimester}`
        if (declaredUrssafSet.has(trimesterKey)) continue

        estimatedUrssaf += await calculateUrssafForTrimester(trimester, previousYear)
      }

      // Check current year (up to current trimester)
      const currentTrimester = Math.ceil(currentMonth / 3)
      for (let trimester = 1; trimester <= currentTrimester; trimester++) {
        const trimesterKey = `${currentYear}-T${trimester}`
        if (declaredUrssafSet.has(trimesterKey)) continue

        // For current trimester, only count months up to current month
        const maxMonth = trimester === currentTrimester ? currentMonth : undefined
        estimatedUrssaf += await calculateUrssafForTrimester(trimester, currentYear, maxMonth)
      }

      // Calculate estimated income tax for the current year
      const yearStart = `${currentYear}-01-01`
      const yearEnd = `${currentYear}-12-31`
      const yearlyRevenueResult = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.isCanceled, false),
            gte(invoices.paymentDate, yearStart),
            lte(invoices.paymentDate, yearEnd)
          )
        )

      const yearlyRevenueHt = parseFloat(yearlyRevenueResult[0].totalHt)
      const estimatedIncomeTax = yearlyRevenueHt * (taxRate / 100)

      // Calculate totals (include both pending and estimated)
      const totalObligations = pendingTva + estimatedTva + pendingUrssaf + estimatedUrssaf + pendingIncomeTax + estimatedIncomeTax
      const availableFunds = currentBalance - totalObligations - monthlySalary

      return {
        currentBalance: currentBalance.toFixed(2),
        pendingTva: pendingTva.toFixed(2),
        estimatedTva: estimatedTva.toFixed(2),
        pendingUrssaf: pendingUrssaf.toFixed(2),
        estimatedUrssaf: estimatedUrssaf.toFixed(2),
        pendingIncomeTax: pendingIncomeTax.toFixed(2),
        estimatedIncomeTax: estimatedIncomeTax.toFixed(2),
        totalObligations: totalObligations.toFixed(2),
        nextMonthSalary: monthlySalary.toFixed(2),
        availableFunds: availableFunds.toFixed(2),
      }
    }
  )
}
