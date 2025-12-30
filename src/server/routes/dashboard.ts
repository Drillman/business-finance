import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { invoices, expenses, taxPayments, urssafPayments, incomeTaxPayments, settings } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const querySchema = z.object({
  year: z.coerce.number().min(2000).max(2100),
  month: z.coerce.number().min(1).max(12),
})

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard summary for a specific month
  fastify.get(
    '/api/dashboard/summary',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, month } = parseResult.data
      const userId = request.authUser.userId

      // Calculate date range for the month
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

      // Get user settings
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })

      const urssafRate = userSettings ? parseFloat(userSettings.urssafRate) : 22
      const taxRate = userSettings ? parseFloat(userSettings.estimatedTaxRate) : 11

      // Get invoice totals for the month (based on payment date)
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

      // Get non-recurring expense totals for the month
      const nonRecurringExpenseResult = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${expenses.amountHt}::numeric), 0)`,
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

      // Get recurring expenses that apply to this month
      const recurringExpensesList = await db
        .select({
          amountHt: expenses.amountHt,
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

      // Calculate recurring expense totals based on recurrence period
      let recurringExpensesHt = 0
      let recurringTvaRecoverable = 0
      for (const expense of recurringExpensesList) {
        const expenseStartMonth = new Date(expense.startMonth!).getMonth()
        const currentMonth = month - 1 // JavaScript months are 0-indexed

        let shouldInclude = false
        if (expense.recurrencePeriod === 'monthly') {
          shouldInclude = true
        } else if (expense.recurrencePeriod === 'quarterly') {
          // Include if the month aligns with the quarterly schedule
          shouldInclude = (currentMonth - expenseStartMonth + 12) % 3 === 0
        } else if (expense.recurrencePeriod === 'yearly') {
          // Include only in the anniversary month
          shouldInclude = currentMonth === expenseStartMonth
        }

        if (shouldInclude) {
          recurringExpensesHt += parseFloat(expense.amountHt || '0')
          const taxAmount = parseFloat(expense.taxAmount || '0')
          const recoveryRate = parseFloat(expense.taxRecoveryRate || '100')
          recurringTvaRecoverable += taxAmount * recoveryRate / 100
        }
      }

      const nonRecurringExpensesHt = parseFloat(nonRecurringExpenseResult[0].totalHt)
      const nonRecurringTvaRecoverable = parseFloat(nonRecurringExpenseResult[0].recoverableTax)
      const expensesHt = nonRecurringExpensesHt + recurringExpensesHt
      const tvaRecoverable = nonRecurringTvaRecoverable + recurringTvaRecoverable
      const netTva = tvaCollected - tvaRecoverable

      // Calculate estimates
      const urssafEstimate = revenueHt * (urssafRate / 100)
      const incomeTaxEstimate = revenueHt * (taxRate / 100)
      const netRemaining = revenueHt - urssafEstimate - incomeTaxEstimate - expensesHt

      // Get pending TVA payments
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

      // Get pending Urssaf payments
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

      // Get upcoming payments (pending payments sorted by period/date)
      const upcomingTvaPayments = await db
        .select()
        .from(taxPayments)
        .where(
          and(
            eq(taxPayments.userId, userId),
            eq(taxPayments.status, 'pending')
          )
        )
        .orderBy(taxPayments.periodMonth)
        .limit(3)

      const upcomingUrssafPayments = await db
        .select()
        .from(urssafPayments)
        .where(
          and(
            eq(urssafPayments.userId, userId),
            eq(urssafPayments.status, 'pending')
          )
        )
        .orderBy(urssafPayments.year, urssafPayments.trimester)
        .limit(3)

      // Helper to format period month as readable date
      const formatPeriodMonth = (periodMonth: string) => {
        const [y, m] = periodMonth.split('-')
        const date = new Date(parseInt(y), parseInt(m) - 1, 1)
        return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      }

      const upcomingPayments: { type: 'tva' | 'urssaf'; amount: string; dueDate?: string; description: string }[] = [
        ...upcomingTvaPayments.map((p) => ({
          type: 'tva' as const,
          amount: p.amount,
          dueDate: p.periodMonth,
          description: `TVA ${formatPeriodMonth(p.periodMonth)}`,
        })),
        ...upcomingUrssafPayments.map((p) => ({
          type: 'urssaf' as const,
          amount: p.amount,
          dueDate: undefined,
          description: `Urssaf T${p.trimester} ${p.year}`,
        })),
      ].sort((a, b) => {
        // Sort by due date if available, otherwise by description
        if (a.dueDate && b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate)
        }
        return a.description.localeCompare(b.description)
      }).slice(0, 5)

      return {
        month,
        year,
        revenueHt: revenueHt.toFixed(2),
        revenueTtc: revenueTtc.toFixed(2),
        tvaCollected: tvaCollected.toFixed(2),
        tvaRecoverable: tvaRecoverable.toFixed(2),
        netTva: netTva.toFixed(2),
        urssafEstimate: urssafEstimate.toFixed(2),
        incomeTaxEstimate: incomeTaxEstimate.toFixed(2),
        expensesHt: expensesHt.toFixed(2),
        netRemaining: netRemaining.toFixed(2),
        pendingTva: pendingTva.toFixed(2),
        pendingUrssaf: pendingUrssaf.toFixed(2),
        upcomingPayments,
      }
    }
  )

  // Get yearly dashboard with KPIs and monthly breakdown
  fastify.get(
    '/api/dashboard/yearly',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const yearQuerySchema = z.object({
        year: z.coerce.number().min(2000).max(2100),
      })

      const parseResult = yearQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year } = parseResult.data
      const userId = request.authUser.userId

      // Get current month to determine which months to show
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      const maxMonth = year === currentYear ? currentMonth : 12

      // Get user settings
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })

      const urssafRate = userSettings ? parseFloat(userSettings.urssafRate) : 22
      const taxRate = userSettings ? parseFloat(userSettings.estimatedTaxRate) : 11

      // Get all recurring expenses for the year
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`
      const recurringExpensesList = await db
        .select({
          amountHt: expenses.amountHt,
          taxAmount: expenses.taxAmount,
          taxRecoveryRate: expenses.taxRecoveryRate,
          startMonth: expenses.startMonth,
          endMonth: expenses.endMonth,
          recurrencePeriod: expenses.recurrencePeriod,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            eq(expenses.isRecurring, true),
            lte(expenses.startMonth, yearEnd),
            sql`(${expenses.endMonth} IS NULL OR ${expenses.endMonth} >= ${yearStart})`
          )
        )

      // Get all Urssaf payments for the year
      const urssafPaymentsList = await db
        .select()
        .from(urssafPayments)
        .where(
          and(
            eq(urssafPayments.userId, userId),
            eq(urssafPayments.year, year)
          )
        )

      // Get all TVA payments for the year
      const tvaPaymentsList = await db
        .select()
        .from(taxPayments)
        .where(
          and(
            eq(taxPayments.userId, userId),
            sql`${taxPayments.periodMonth} >= ${yearStart.substring(0, 7)}`,
            sql`${taxPayments.periodMonth} <= ${yearEnd.substring(0, 7)}`
          )
        )

      // Get all income tax payments for the year
      const incomeTaxPaymentsList = await db
        .select()
        .from(incomeTaxPayments)
        .where(
          and(
            eq(incomeTaxPayments.userId, userId),
            eq(incomeTaxPayments.year, year)
          )
        )

      // Helper function to check if recurring expense applies to a month
      const getRecurringExpenseForMonth = (month: number) => {
        let totalHt = 0
        let totalTvaRecoverable = 0

        for (const expense of recurringExpensesList) {
          const expenseStart = new Date(expense.startMonth!)
          const expenseEnd = expense.endMonth ? new Date(expense.endMonth) : null
          const monthDate = new Date(year, month - 1, 1)

          // Check if expense is active in this month
          if (expenseStart > monthDate) continue
          if (expenseEnd && expenseEnd < monthDate) continue

          const expenseStartMonth = expenseStart.getMonth()
          const currentMonthIndex = month - 1

          let shouldInclude = false
          if (expense.recurrencePeriod === 'monthly') {
            shouldInclude = true
          } else if (expense.recurrencePeriod === 'quarterly') {
            shouldInclude = (currentMonthIndex - expenseStartMonth + 12) % 3 === 0
          } else if (expense.recurrencePeriod === 'yearly') {
            shouldInclude = currentMonthIndex === expenseStartMonth
          }

          if (shouldInclude) {
            totalHt += parseFloat(expense.amountHt || '0')
            const taxAmount = parseFloat(expense.taxAmount || '0')
            const recoveryRate = parseFloat(expense.taxRecoveryRate || '100')
            totalTvaRecoverable += taxAmount * recoveryRate / 100
          }
        }

        return { totalHt, totalTvaRecoverable }
      }

      // Helper to get trimester for a month
      const getTrimesterForMonth = (month: number) => Math.ceil(month / 3)

      // Build monthly breakdown
      const months = []
      let yearlyTotals = {
        revenue: 0,
        urssafPaid: 0,
        urssafEstimated: 0,
        incomeTaxEstimated: 0,
        tvaPaid: 0,
        tvaEstimated: 0,
        remaining: 0,
      }

      for (let month = 1; month <= maxMonth; month++) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
        const periodMonth = `${year}-${month.toString().padStart(2, '0')}`

        // Get revenue for this month
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

        // Get non-recurring expenses for this month
        const nonRecurringResult = await db
          .select({
            totalHt: sql<string>`COALESCE(SUM(${expenses.amountHt}::numeric), 0)`,
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

        const nonRecurringHt = parseFloat(nonRecurringResult[0].totalHt)
        const nonRecurringTva = parseFloat(nonRecurringResult[0].recoverableTax)

        // Get recurring expenses for this month
        const recurring = getRecurringExpenseForMonth(month)
        const expensesHt = nonRecurringHt + recurring.totalHt
        const tvaRecoverable = nonRecurringTva + recurring.totalTvaRecoverable
        const netTva = tvaCollected - tvaRecoverable

        // Get Urssaf for this month's trimester
        const trimester = getTrimesterForMonth(month)
        const urssafPayment = urssafPaymentsList.find(p => p.trimester === trimester)
        const urssafEstimate = revenueHt * (urssafRate / 100)

        // Always show estimated amount, but track if payment is done for the trimester
        const urssafDisplay = urssafEstimate
        const urssafIsPaid = urssafPayment?.status === 'paid'

        // Get TVA payment for this month
        const tvaPayment = tvaPaymentsList.find(p => p.periodMonth === periodMonth)
        let tvaDisplay = netTva
        let tvaIsPaid = false
        if (tvaPayment && tvaPayment.status === 'paid') {
          tvaDisplay = parseFloat(tvaPayment.amount)
          tvaIsPaid = true
        }

        // Income tax estimate for this month
        const incomeTaxEstimate = revenueHt * (taxRate / 100)

        // Calculate remaining (TVA is not subtracted as it's a pass-through: collected from clients, paid to state)
        const remaining = revenueHt - expensesHt - urssafDisplay - incomeTaxEstimate

        months.push({
          month,
          revenue: revenueHt.toFixed(2),
          expensesHt: expensesHt.toFixed(2),
          urssaf: urssafDisplay.toFixed(2),
          urssafIsPaid,
          incomeTax: incomeTaxEstimate.toFixed(2),
          tva: tvaDisplay.toFixed(2),
          tvaIsPaid,
          remaining: remaining.toFixed(2),
        })

        // Accumulate yearly totals
        yearlyTotals.revenue += revenueHt
        if (urssafIsPaid) {
          yearlyTotals.urssafPaid += urssafEstimate
        } else {
          yearlyTotals.urssafEstimated += urssafEstimate
        }
        yearlyTotals.incomeTaxEstimated += incomeTaxEstimate
        if (tvaIsPaid) {
          yearlyTotals.tvaPaid += tvaDisplay
        } else {
          yearlyTotals.tvaEstimated += netTva
        }
        yearlyTotals.remaining += remaining
      }

      // Calculate total paid income tax for the year
      const incomeTaxPaid = incomeTaxPaymentsList
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0)

      // KPIs
      const kpis = {
        totalRevenue: yearlyTotals.revenue.toFixed(2),
        totalUrssafPaid: yearlyTotals.urssafPaid.toFixed(2),
        totalUrssafEstimated: yearlyTotals.urssafEstimated.toFixed(2),
        totalUrssaf: (yearlyTotals.urssafPaid + yearlyTotals.urssafEstimated).toFixed(2),
        totalIncomeTaxPaid: incomeTaxPaid.toFixed(2),
        totalIncomeTaxEstimated: yearlyTotals.incomeTaxEstimated.toFixed(2),
        totalTvaPaid: yearlyTotals.tvaPaid.toFixed(2),
        totalTvaEstimated: yearlyTotals.tvaEstimated.toFixed(2),
        totalRemaining: yearlyTotals.remaining.toFixed(2),
      }

      return {
        year,
        currentMonth: year === currentYear ? currentMonth : null,
        kpis,
        months,
      }
    }
  )
}
