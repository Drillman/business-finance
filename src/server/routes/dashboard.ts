import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { invoices, expenses, taxPayments, urssafPayments, settings } from '../db/schema'
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

      // Get expense totals for the month
      const expenseResult = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${expenses.amountHt}::numeric), 0)`,
          recoverableTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric * ${expenses.taxRecoveryRate}::numeric / 100), 0)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        )

      const expensesHt = parseFloat(expenseResult[0].totalHt)
      const tvaRecoverable = parseFloat(expenseResult[0].recoverableTax)
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
        .orderBy(taxPayments.periodEnd)
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

      const upcomingPayments: { type: 'tva' | 'urssaf'; amount: string; dueDate?: string; description: string }[] = [
        ...upcomingTvaPayments.map((p) => ({
          type: 'tva' as const,
          amount: p.amount,
          dueDate: p.periodEnd,
          description: `TVA ${p.periodStart} - ${p.periodEnd}`,
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
}
