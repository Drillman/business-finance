import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { expenses } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const expenseCategories = ['fixed', 'one-time', 'recurring', 'professional', 'other'] as const

const createExpenseSchema = z.object({
  description: z.string().min(1, 'La description est requise'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  amountHt: z.number().positive('Le montant HT doit être positif'),
  taxAmount: z.number().min(0, 'Le montant de TVA ne peut pas être négatif').default(0),
  taxRecoveryRate: z.number().min(0).max(100).default(100),
  category: z.enum(expenseCategories, { message: 'Catégorie invalide' }),
  isRecurring: z.boolean().default(false),
  isIntraEu: z.boolean().default(false),
  recurrencePeriod: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  startMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  endMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  paymentDay: z.number().min(1).max(31).optional(),
  note: z.string().optional(),
})

const updateExpenseSchema = createExpenseSchema.partial()

const listQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)').optional(),
  category: z.enum(expenseCategories).optional(),
  isRecurring: z.string().transform(val => val === 'true').optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export async function expenseRoutes(fastify: FastifyInstance) {
  // List expenses
  fastify.get(
    '/api/expenses',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { month, category, isRecurring, limit, offset } = parseResult.data
      const userId = request.authUser.userId

      const conditions = [eq(expenses.userId, userId)]

      if (month) {
        const startDate = `${month}-01`
        const [year, monthNum] = month.split('-').map(Number)
        const lastDay = new Date(year, monthNum, 0).getDate()
        const endDate = `${month}-${lastDay.toString().padStart(2, '0')}`
        conditions.push(gte(expenses.date, startDate))
        conditions.push(lte(expenses.date, endDate))
      }

      if (category) {
        conditions.push(eq(expenses.category, category))
      }

      if (isRecurring !== undefined) {
        conditions.push(eq(expenses.isRecurring, isRecurring))
      }

      const results = await db
        .select()
        .from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.date))
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(expenses)
        .where(and(...conditions))

      return {
        data: results,
        total: Number(countResult[0].count),
        limit,
        offset,
      }
    }
  )

  // Get single expense
  fastify.get(
    '/api/expenses/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const expense = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      })

      if (!expense) {
        return reply.status(404).send({ message: 'Dépense non trouvée' })
      }

      return expense
    }
  )

  // Create expense
  fastify.post(
    '/api/expenses',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createExpenseSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const data = parseResult.data
      const userId = request.authUser.userId

      // Validate recurring expense fields
      if (data.isRecurring) {
        if (!data.recurrencePeriod) {
          return reply.status(400).send({
            message: 'La période de récurrence est requise pour les dépenses récurrentes',
          })
        }
        if (!data.startMonth) {
          return reply.status(400).send({
            message: 'Le mois de début est requis pour les charges fixes',
          })
        }
        if (!data.paymentDay) {
          return reply.status(400).send({
            message: 'Le jour de paiement est requis pour les charges fixes',
          })
        }
      }

      const [expense] = await db
        .insert(expenses)
        .values({
          userId,
          description: data.description,
          date: data.date,
          amountHt: data.amountHt.toFixed(2),
          taxAmount: data.taxAmount.toFixed(2),
          taxRecoveryRate: data.taxRecoveryRate.toFixed(2),
          category: data.category,
          isRecurring: data.isRecurring,
          isIntraEu: data.isIntraEu,
          recurrencePeriod: data.recurrencePeriod,
          startMonth: data.startMonth,
          endMonth: data.endMonth,
          paymentDay: data.paymentDay,
          note: data.note,
        })
        .returning()

      return reply.status(201).send(expense)
    }
  )

  // Update expense
  fastify.put(
    '/api/expenses/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const parseResult = updateExpenseSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const existing = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Dépense non trouvée' })
      }

      const data = parseResult.data
      const updateData: Record<string, unknown> = {}

      if (data.description !== undefined) updateData.description = data.description
      if (data.date !== undefined) updateData.date = data.date
      if (data.amountHt !== undefined) updateData.amountHt = data.amountHt.toFixed(2)
      if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount.toFixed(2)
      if (data.taxRecoveryRate !== undefined) updateData.taxRecoveryRate = data.taxRecoveryRate.toFixed(2)
      if (data.category !== undefined) updateData.category = data.category
      if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring
      if (data.isIntraEu !== undefined) updateData.isIntraEu = data.isIntraEu
      if (data.recurrencePeriod !== undefined) updateData.recurrencePeriod = data.recurrencePeriod
      if (data.startMonth !== undefined) updateData.startMonth = data.startMonth
      if (data.endMonth !== undefined) updateData.endMonth = data.endMonth
      if (data.paymentDay !== undefined) updateData.paymentDay = data.paymentDay
      if (data.note !== undefined) updateData.note = data.note

      // Validate recurrence consistency
      const finalIsRecurring = data.isRecurring ?? existing.isRecurring
      const finalRecurrencePeriod = data.recurrencePeriod ?? existing.recurrencePeriod
      const finalStartMonth = data.startMonth ?? existing.startMonth
      const finalPaymentDay = data.paymentDay ?? existing.paymentDay
      if (finalIsRecurring) {
        if (!finalRecurrencePeriod) {
          return reply.status(400).send({
            message: 'La période de récurrence est requise pour les dépenses récurrentes',
          })
        }
        if (!finalStartMonth) {
          return reply.status(400).send({
            message: 'Le mois de début est requis pour les charges fixes',
          })
        }
        if (!finalPaymentDay) {
          return reply.status(400).send({
            message: 'Le jour de paiement est requis pour les charges fixes',
          })
        }
      }

      const [updated] = await db
        .update(expenses)
        .set(updateData)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning()

      return updated
    }
  )

  // Delete expense
  fastify.delete(
    '/api/expenses/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const existing = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Dépense non trouvée' })
      }

      await db
        .delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Get expense summary for a period
  fastify.get(
    '/api/expenses/summary/monthly',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        year: z.coerce.number().min(2000).max(2100),
        month: z.coerce.number().min(1).max(12),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, month } = parseResult.data
      const userId = request.authUser.userId

      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

      const result = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${expenses.amountHt}::numeric), 0)`,
          totalTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric), 0)`,
          recoverableTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric * ${expenses.taxRecoveryRate}::numeric / 100), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        )

      // Get breakdown by category
      const categoryBreakdown = await db
        .select({
          category: expenses.category,
          total: sql<string>`COALESCE(SUM(${expenses.amountHt}::numeric), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        )
        .groupBy(expenses.category)

      return {
        year,
        month,
        totalHt: parseFloat(result[0].totalHt).toFixed(2),
        totalTax: parseFloat(result[0].totalTax).toFixed(2),
        recoverableTax: parseFloat(result[0].recoverableTax).toFixed(2),
        count: Number(result[0].count),
        byCategory: categoryBreakdown.map((c) => ({
          category: c.category,
          total: parseFloat(c.total).toFixed(2),
          count: Number(c.count),
        })),
      }
    }
  )

  // Get recurring expenses
  fastify.get(
    '/api/expenses/recurring',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)').optional(),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { month } = parseResult.data
      const userId = request.authUser.userId

      const conditions = [eq(expenses.userId, userId), eq(expenses.isRecurring, true)]

      // Filter by active month if provided
      if (month) {
        const monthDate = `${month}-01`
        // startMonth <= selectedMonth AND (endMonth IS NULL OR endMonth >= selectedMonth)
        conditions.push(lte(expenses.startMonth, monthDate))
        conditions.push(
          sql`(${expenses.endMonth} IS NULL OR ${expenses.endMonth} >= ${monthDate})`
        )
      }

      const results = await db
        .select()
        .from(expenses)
        .where(and(...conditions))
        .orderBy(expenses.description)

      return { data: results }
    }
  )
}
