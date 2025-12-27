import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import { accountBalances, taxPayments, urssafPayments, incomeTaxPayments, settings } from '../db/schema'
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

      // Get monthly salary from settings
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })
      const monthlySalary = userSettings ? parseFloat(userSettings.monthlySalary) : 3000

      // Calculate totals
      const totalObligations = pendingTva + pendingUrssaf + pendingIncomeTax
      const availableFunds = currentBalance - totalObligations - monthlySalary

      return {
        currentBalance: currentBalance.toFixed(2),
        pendingTva: pendingTva.toFixed(2),
        pendingUrssaf: pendingUrssaf.toFixed(2),
        pendingIncomeTax: pendingIncomeTax.toFixed(2),
        totalObligations: totalObligations.toFixed(2),
        nextMonthSalary: monthlySalary.toFixed(2),
        availableFunds: availableFunds.toFixed(2),
      }
    }
  )
}
