import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { taxPayments, invoices, expenses } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const createTaxPaymentSchema = z.object({
  amount: z.number().positive('Le montant doit être positif'),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)'),
  status: z.enum(['pending', 'paid']).default('pending'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
})

const updateTaxPaymentSchema = createTaxPaymentSchema.partial()

const listQuerySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  status: z.enum(['pending', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export async function tvaRoutes(fastify: FastifyInstance) {
  // List tax payments
  fastify.get(
    '/api/tva/payments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, status, limit, offset } = parseResult.data
      const userId = request.authUser.userId

      const conditions = [eq(taxPayments.userId, userId)]

      if (year) {
        conditions.push(sql`${taxPayments.periodMonth} LIKE ${`${year}-%`}`)
      }

      if (status) {
        conditions.push(eq(taxPayments.status, status))
      }

      const results = await db
        .select()
        .from(taxPayments)
        .where(and(...conditions))
        .orderBy(desc(taxPayments.periodMonth))
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(taxPayments)
        .where(and(...conditions))

      return {
        data: results,
        total: Number(countResult[0].count),
        limit,
        offset,
      }
    }
  )

  // Get single tax payment
  fastify.get(
    '/api/tva/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const payment = await db.query.taxPayments.findFirst({
        where: and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)),
      })

      if (!payment) {
        return reply.status(404).send({ message: 'Paiement TVA non trouvé' })
      }

      return payment
    }
  )

  // Create tax payment
  fastify.post(
    '/api/tva/payments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createTaxPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const data = parseResult.data
      const userId = request.authUser.userId

      const [payment] = await db
        .insert(taxPayments)
        .values({
          userId,
          amount: data.amount.toFixed(2),
          periodMonth: data.periodMonth,
          status: data.status,
          paymentDate: data.paymentDate,
          reference: data.reference,
          note: data.note,
        })
        .returning()

      return reply.status(201).send(payment)
    }
  )

  // Update tax payment
  fastify.put(
    '/api/tva/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const parseResult = updateTaxPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const existing = await db.query.taxPayments.findFirst({
        where: and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Paiement TVA non trouvé' })
      }

      const data = parseResult.data
      const updateData: Record<string, unknown> = {}

      if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2)
      if (data.periodMonth !== undefined) updateData.periodMonth = data.periodMonth
      if (data.status !== undefined) updateData.status = data.status
      if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate
      if (data.reference !== undefined) updateData.reference = data.reference
      if (data.note !== undefined) updateData.note = data.note

      const [updated] = await db
        .update(taxPayments)
        .set(updateData)
        .where(and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)))
        .returning()

      return updated
    }
  )

  // Delete tax payment
  fastify.delete(
    '/api/tva/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const existing = await db.query.taxPayments.findFirst({
        where: and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Paiement TVA non trouvé' })
      }

      await db
        .delete(taxPayments)
        .where(and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Get TVA summary for a period
  fastify.get(
    '/api/tva/summary',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { startDate, endDate } = parseResult.data
      const userId = request.authUser.userId

      // Get TVA collected from invoices (based on payment date)
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

      const totalHt = parseFloat(invoiceResult[0].totalHt)
      const totalTtc = parseFloat(invoiceResult[0].totalTtc)
      const tvaCollected = totalTtc - totalHt

      // Get TVA recoverable from non-recurring expenses
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

      // Get TVA recoverable from recurring expenses
      // We need to calculate how many months each recurring expense applies to within the period
      const recurringExpenses = await db
        .select({
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
            lte(expenses.startMonth, endDate),
            sql`(${expenses.endMonth} IS NULL OR ${expenses.endMonth} >= ${startDate})`
          )
        )

      // Calculate total recurring TVA
      let recurringTvaRecoverable = 0
      const periodStartDate = new Date(startDate)
      const periodEndDate = new Date(endDate)

      for (const expense of recurringExpenses) {
        const expenseStart = new Date(expense.startMonth!)
        const expenseEnd = expense.endMonth ? new Date(expense.endMonth) : periodEndDate

        // Calculate the effective range for this expense within the query period
        const effectiveStart = expenseStart > periodStartDate ? expenseStart : periodStartDate
        const effectiveEnd = expenseEnd < periodEndDate ? expenseEnd : periodEndDate

        // Count the number of months this expense applies (considering recurrence period)
        let monthCount = 0
        const current = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1)
        const endCheck = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1)

        while (current <= endCheck) {
          if (expense.recurrencePeriod === 'monthly') {
            monthCount++
          } else if (expense.recurrencePeriod === 'quarterly') {
            // Only count if it's a quarter month (Jan, Apr, Jul, Oct or based on start)
            const startMonth = expenseStart.getMonth()
            const currentMonth = current.getMonth()
            if ((currentMonth - startMonth + 12) % 3 === 0) {
              monthCount++
            }
          } else if (expense.recurrencePeriod === 'yearly') {
            // Only count if it's the anniversary month
            if (current.getMonth() === expenseStart.getMonth()) {
              monthCount++
            }
          }
          current.setMonth(current.getMonth() + 1)
        }

        const taxAmount = parseFloat(expense.taxAmount || '0')
        const recoveryRate = parseFloat(expense.taxRecoveryRate || '100')
        recurringTvaRecoverable += (taxAmount * recoveryRate / 100) * monthCount
      }

      const tvaRecoverable = parseFloat(nonRecurringResult[0].recoverableTax) + recurringTvaRecoverable
      const netTva = tvaCollected - tvaRecoverable

      // Get payments made in this period
      // Convert dates to YYYY-MM format for comparison
      const startMonth = startDate.substring(0, 7)
      const endMonth = endDate.substring(0, 7)
      const paymentsResult = await db
        .select({
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${taxPayments.status} = 'paid' THEN ${taxPayments.amount}::numeric ELSE 0 END), 0)`,
          totalPending: sql<string>`COALESCE(SUM(CASE WHEN ${taxPayments.status} = 'pending' THEN ${taxPayments.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(taxPayments)
        .where(
          and(
            eq(taxPayments.userId, userId),
            gte(taxPayments.periodMonth, startMonth),
            lte(taxPayments.periodMonth, endMonth)
          )
        )

      return {
        startDate,
        endDate,
        tvaCollected: tvaCollected.toFixed(2),
        tvaRecoverable: tvaRecoverable.toFixed(2),
        netTva: netTva.toFixed(2),
        totalPaid: parseFloat(paymentsResult[0].totalPaid).toFixed(2),
        totalPending: parseFloat(paymentsResult[0].totalPending).toFixed(2),
        balance: (netTva - parseFloat(paymentsResult[0].totalPaid)).toFixed(2),
      }
    }
  )

  // Get monthly TVA breakdown
  fastify.get(
    '/api/tva/monthly',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        year: z.coerce.number().min(2000).max(2100),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year } = parseResult.data
      const userId = request.authUser.userId

      // Fetch all payments for the year at once to avoid N+1 queries
      const yearPayments = await db
        .select()
        .from(taxPayments)
        .where(
          and(
            eq(taxPayments.userId, userId),
            sql`${taxPayments.periodMonth} LIKE ${`${year}-%`}`
          )
        )

      // Group payments by month
      const paymentsByMonth = new Map<number, { status: string; amount: string }[]>()
      for (const payment of yearPayments) {
        const paymentMonth = parseInt(payment.periodMonth.split('-')[1])
        if (!paymentsByMonth.has(paymentMonth)) {
          paymentsByMonth.set(paymentMonth, [])
        }
        paymentsByMonth.get(paymentMonth)!.push({
          status: payment.status,
          amount: payment.amount,
        })
      }

      const monthlyData = []

      for (let month = 1; month <= 12; month++) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

        // TVA collected from invoices
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

        const totalHt = parseFloat(invoiceResult[0].totalHt)
        const totalTtc = parseFloat(invoiceResult[0].totalTtc)
        const collected = totalTtc - totalHt

        // TVA recoverable from non-recurring expenses (based on expense date)
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

        // TVA recoverable from recurring expenses (based on startMonth/endMonth range and recurrence period)
        const recurringExpensesList = await db
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
            const taxAmount = parseFloat(expense.taxAmount || '0')
            const recoveryRate = parseFloat(expense.taxRecoveryRate || '100')
            recurringTax += taxAmount * recoveryRate / 100
          }
        }

        const nonRecurringTax = parseFloat(nonRecurringResult[0].recoverableTax)
        const recoverable = nonRecurringTax + recurringTax
        const netTva = collected - recoverable

        // Calculate payment status for this month
        const monthPayments = paymentsByMonth.get(month) || []
        const paidAmount = monthPayments
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)
        const pendingAmount = monthPayments
          .filter(p => p.status === 'pending')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)

        // Calculate due date: 19th of the following month, or next weekday if weekend
        const calculateDueDate = (y: number, m: number): string => {
          // Due date is 19th of the following month
          let dueDate = new Date(y, m, 19) // m is already 0-indexed month + 1 = following month
          const dayOfWeek = dueDate.getDay()
          // If Saturday (6), move to Monday (add 2 days)
          // If Sunday (0), move to Monday (add 1 day)
          if (dayOfWeek === 6) {
            dueDate = new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000)
          } else if (dayOfWeek === 0) {
            dueDate = new Date(dueDate.getTime() + 1 * 24 * 60 * 60 * 1000)
          }
          return dueDate.toISOString().split('T')[0]
        }

        const dueDate = calculateDueDate(year, month)
        const today = new Date().toISOString().split('T')[0]
        const monthEnd = new Date(year, month, 0) // Last day of the month
        const isMonthComplete = new Date() > monthEnd

        // Determine payment status
        // 'paid' - a payment has been made for this month
        // 'pending' - payment created but not yet paid
        // 'overdue' - month is complete, no payment, and due date has passed
        // 'upcoming' - month is complete but due date not yet reached
        // 'not_due' - month not yet complete
        let paymentStatus: 'paid' | 'pending' | 'due' | 'overdue' | 'upcoming' | 'not_due'
        if (paidAmount > 0) {
          // If any payment was made, consider it paid
          paymentStatus = 'paid'
        } else if (pendingAmount > 0) {
          paymentStatus = 'pending'
        } else if (!isMonthComplete) {
          paymentStatus = 'not_due'
        } else if (netTva <= 0) {
          // No TVA to pay for this month
          paymentStatus = 'not_due'
        } else if (today > dueDate) {
          paymentStatus = 'overdue'
        } else {
          paymentStatus = 'upcoming'
        }

        monthlyData.push({
          month,
          year,
          tvaCollected: collected.toFixed(2),
          tvaRecoverable: recoverable.toFixed(2),
          netTva: netTva.toFixed(2),
          paidAmount: paidAmount.toFixed(2),
          pendingAmount: pendingAmount.toFixed(2),
          dueDate,
          paymentStatus,
        })
      }

      return { year, months: monthlyData }
    }
  )

  // Get TVA declaration data for a specific month
  fastify.get(
    '/api/tva/declaration/:month',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const paramsSchema = z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)'),
      })

      const parseResult = paramsSchema.safeParse(request.params)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { month } = parseResult.data
      const userId = request.authUser.userId

      // Calculate date range for the month
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = `${month}-01`
      const lastDay = new Date(year, monthNum, 0).getDate()
      const endDate = `${month}-${lastDay.toString().padStart(2, '0')}`

      // A1: Get invoices paid this month (based on paymentDate)
      const invoicesPaid = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.isCanceled, false),
            gte(invoices.paymentDate, startDate),
            lte(invoices.paymentDate, endDate)
          )
        )
        .orderBy(invoices.paymentDate)

      // Calculate A1 without rounding for intermediate calculations
      const A1Raw = invoicesPaid.reduce((sum, inv) => sum + parseFloat(inv.amountHt), 0)

      // B2: Get intra-EU expenses for this month (non-recurring only for now)
      const expensesIntraEu = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            eq(expenses.isIntraEu, true),
            eq(expenses.isRecurring, false),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        )
        .orderBy(expenses.date)

      // Calculate B2 without rounding for intermediate calculations
      const B2Raw = expensesIntraEu.reduce((sum, exp) => sum + parseFloat(exp.amountHt), 0)

      // Case 08: Base HT 20% (using raw values)
      const case08Raw = A1Raw + B2Raw

      // Case 17: TVA on intra-EU (20% of B2) - using raw value
      const case17Raw = B2Raw * 0.20

      // Get non-intra-EU, non-recurring expenses with TVA for this month
      const nonIntraEuExpenses = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            eq(expenses.isIntraEu, false),
            eq(expenses.isRecurring, false),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate),
            sql`${expenses.taxAmount}::numeric > 0`
          )
        )
        .orderBy(expenses.date)

      // Get recurring expenses that apply to this month
      const recurringExpensesList = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            eq(expenses.isRecurring, true),
            lte(expenses.startMonth, startDate),
            sql`(${expenses.endMonth} IS NULL OR ${expenses.endMonth} >= ${startDate})`
          )
        )
        .orderBy(expenses.description)

      // Filter recurring expenses that apply to this specific month
      const recurringExpensesThisMonth: typeof recurringExpensesList = []
      for (const expense of recurringExpensesList) {
        const expenseStartMonth = new Date(expense.startMonth!).getMonth()
        const currentMonth = monthNum - 1 // JavaScript months are 0-indexed

        let shouldInclude = false
        if (expense.recurrencePeriod === 'monthly') {
          shouldInclude = true
        } else if (expense.recurrencePeriod === 'quarterly') {
          shouldInclude = (currentMonth - expenseStartMonth + 12) % 3 === 0
        } else if (expense.recurrencePeriod === 'yearly') {
          shouldInclude = currentMonth === expenseStartMonth
        }

        if (shouldInclude) {
          recurringExpensesThisMonth.push(expense)
        }
      }

      // Combine non-recurring and recurring non-intra-EU expenses with TVA
      const allNonIntraEuExpenses = [
        ...nonIntraEuExpenses,
        ...recurringExpensesThisMonth.filter(
          (exp) => !exp.isIntraEu && parseFloat(exp.taxAmount || '0') > 0
        ),
      ]

      // Case 19: TVA deductible on immobilisations (expenses > 500 EUR HT)
      const expensesOver500 = allNonIntraEuExpenses.filter(
        (exp) => parseFloat(exp.amountHt) > 500
      )
      const case19Raw = expensesOver500.reduce((sum, exp) => {
        const taxAmount = parseFloat(exp.taxAmount)
        const recoveryRate = parseFloat(exp.taxRecoveryRate) / 100
        return sum + taxAmount * recoveryRate
      }, 0)

      // Case 20: Other deductible TVA (expenses <= 500 EUR HT) + case 17
      const expensesWithTva = allNonIntraEuExpenses.filter(
        (exp) => parseFloat(exp.amountHt) <= 500
      )
      const tvaDeductibleOtherRaw = expensesWithTva.reduce((sum, exp) => {
        const taxAmount = parseFloat(exp.taxAmount)
        const recoveryRate = parseFloat(exp.taxRecoveryRate) / 100
        return sum + taxAmount * recoveryRate
      }, 0)
      const case20Raw = tvaDeductibleOtherRaw + case17Raw

      // Summary calculations using raw values
      const tvaCollectedRaw = case08Raw * 0.20
      const tvaDeductibleRaw = case19Raw + case20Raw
      const tvaNetRaw = tvaCollectedRaw - tvaDeductibleRaw

      // Only round for the final case values (for display/declaration)
      const A1 = Math.round(A1Raw)
      const B2 = Math.round(B2Raw)
      const case08 = Math.round(case08Raw)
      const case17 = Math.round(case17Raw)
      const case19 = Math.round(case19Raw)
      const case20 = Math.round(case20Raw)
      const tvaCollected = Math.round(tvaCollectedRaw)
      const tvaDeductible = Math.round(tvaDeductibleRaw)
      const tvaNet = Math.round(tvaNetRaw)

      return {
        month,
        cases: {
          A1,
          B2,
          case08,
          case17,
          case19,
          case20,
        },
        details: {
          invoicesPaid,
          expensesWithTva,
          expensesIntraEu,
          expensesOver500,
        },
        summary: {
          tvaCollected,
          tvaDeductible,
          tvaNet,
        },
      }
    }
  )
}
