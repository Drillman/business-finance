import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db'
import { incomeTaxPayments, invoices, settings, taxBrackets } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const createIncomeTaxPaymentSchema = z.object({
  year: z.number().min(2000).max(2100),
  amount: z.number().min(0, 'Le montant ne peut pas être négatif'),
  status: z.enum(['pending', 'paid']).default('pending'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
})

const updateIncomeTaxPaymentSchema = createIncomeTaxPaymentSchema.partial()

const listQuerySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  status: z.enum(['pending', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// French tax brackets for 2025 (revenus 2024)
// Source: https://www.service-public.gouv.fr/particuliers/vosdroits/F1419
const DEFAULT_TAX_BRACKETS_2025 = [
  { minIncome: 0, maxIncome: 11497, rate: 0 },
  { minIncome: 11497, maxIncome: 29315, rate: 11 },
  { minIncome: 29315, maxIncome: 83823, rate: 30 },
  { minIncome: 83823, maxIncome: 180294, rate: 41 },
  { minIncome: 180294, maxIncome: null, rate: 45 },
]

// Helper to calculate progressive tax from brackets
function calculateProgressiveTax(
  taxableIncome: number,
  brackets: { minIncome: string; maxIncome: string | null; rate: string }[]
) {
  let totalTax = 0
  const breakdown: {
    minIncome: string
    maxIncome: string | null
    rate: string
    taxableAmount: string
    taxAmount: string
  }[] = []

  for (const bracket of brackets) {
    const minIncome = parseFloat(bracket.minIncome)
    const maxIncome = bracket.maxIncome ? parseFloat(bracket.maxIncome) : Infinity
    const rate = parseFloat(bracket.rate)

    // Skip if income doesn't reach this bracket
    if (taxableIncome <= minIncome) break

    // Calculate income within this bracket
    const incomeInBracket = Math.min(taxableIncome, maxIncome) - minIncome

    if (incomeInBracket > 0) {
      const taxForBracket = incomeInBracket * (rate / 100)
      totalTax += taxForBracket
      breakdown.push({
        minIncome: bracket.minIncome,
        maxIncome: bracket.maxIncome,
        rate: bracket.rate,
        taxableAmount: incomeInBracket.toFixed(2),
        taxAmount: taxForBracket.toFixed(2),
      })
    }
  }

  return { totalTax, breakdown }
}

export async function incomeTaxRoutes(fastify: FastifyInstance) {
  // List income tax payments
  fastify.get(
    '/api/income-tax/payments',
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

      const conditions = [eq(incomeTaxPayments.userId, userId)]

      if (year) {
        conditions.push(eq(incomeTaxPayments.year, year))
      }

      if (status) {
        conditions.push(eq(incomeTaxPayments.status, status))
      }

      const results = await db
        .select()
        .from(incomeTaxPayments)
        .where(and(...conditions))
        .orderBy(desc(incomeTaxPayments.year), desc(incomeTaxPayments.createdAt))
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(incomeTaxPayments)
        .where(and(...conditions))

      return {
        data: results,
        total: Number(countResult[0].count),
        limit,
        offset,
      }
    }
  )

  // Get single income tax payment
  fastify.get(
    '/api/income-tax/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const payment = await db.query.incomeTaxPayments.findFirst({
        where: and(eq(incomeTaxPayments.id, id), eq(incomeTaxPayments.userId, userId)),
      })

      if (!payment) {
        return reply.status(404).send({ message: 'Paiement d\'impôt non trouvé' })
      }

      return payment
    }
  )

  // Create income tax payment
  fastify.post(
    '/api/income-tax/payments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createIncomeTaxPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const data = parseResult.data
      const userId = request.authUser.userId

      const [payment] = await db
        .insert(incomeTaxPayments)
        .values({
          userId,
          year: data.year,
          amount: data.amount.toFixed(2),
          status: data.status,
          paymentDate: data.paymentDate,
          reference: data.reference,
          note: data.note,
        })
        .returning()

      return reply.status(201).send(payment)
    }
  )

  // Update income tax payment
  fastify.put(
    '/api/income-tax/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const parseResult = updateIncomeTaxPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const existing = await db.query.incomeTaxPayments.findFirst({
        where: and(eq(incomeTaxPayments.id, id), eq(incomeTaxPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Paiement d\'impôt non trouvé' })
      }

      const data = parseResult.data
      const updateData: Record<string, unknown> = {}

      if (data.year !== undefined) updateData.year = data.year
      if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2)
      if (data.status !== undefined) updateData.status = data.status
      if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate
      if (data.reference !== undefined) updateData.reference = data.reference
      if (data.note !== undefined) updateData.note = data.note

      const [updated] = await db
        .update(incomeTaxPayments)
        .set(updateData)
        .where(and(eq(incomeTaxPayments.id, id), eq(incomeTaxPayments.userId, userId)))
        .returning()

      return updated
    }
  )

  // Delete income tax payment
  fastify.delete(
    '/api/income-tax/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const existing = await db.query.incomeTaxPayments.findFirst({
        where: and(eq(incomeTaxPayments.id, id), eq(incomeTaxPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Paiement d\'impôt non trouvé' })
      }

      await db
        .delete(incomeTaxPayments)
        .where(and(eq(incomeTaxPayments.id, id), eq(incomeTaxPayments.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Get annual income tax summary
  fastify.get(
    '/api/income-tax/summary',
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

      // Get user settings for deduction rate
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })

      const deductionRate = userSettings
        ? parseFloat(userSettings.revenueDeductionRate)
        : 34

      const additionalTaxableIncome = userSettings
        ? parseFloat(userSettings.additionalTaxableIncome || '0')
        : 0

      // Get annual revenue from paid invoices
      const invoiceResult = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.isCanceled, false),
            sql`EXTRACT(YEAR FROM ${invoices.paymentDate}) = ${year}`
          )
        )

      const totalRevenue = parseFloat(invoiceResult[0].totalHt)
      const revenueAfterDeduction = totalRevenue * (1 - deductionRate / 100)
      const taxableIncome = revenueAfterDeduction + additionalTaxableIncome

      // Get tax brackets (prefer custom, fallback to official)
      let brackets = await db
        .select()
        .from(taxBrackets)
        .where(eq(taxBrackets.userId, userId))
        .orderBy(taxBrackets.minIncome)

      brackets = brackets.filter((b) => b.year === year)

      if (brackets.length === 0) {
        brackets = await db
          .select()
          .from(taxBrackets)
          .where(eq(taxBrackets.year, year))
          .orderBy(taxBrackets.minIncome)

        brackets = brackets.filter((b) => b.userId === null)
      }

      // Use default 2025 brackets if nothing found
      if (brackets.length === 0) {
        brackets = DEFAULT_TAX_BRACKETS_2025.map((b, i) => ({
          id: `default-${i}`,
          userId: null,
          year: 2025,
          minIncome: b.minIncome.toFixed(2),
          maxIncome: b.maxIncome?.toFixed(2) ?? null,
          rate: b.rate.toFixed(2),
          isCustom: false,
          createdAt: new Date(),
        }))
      }

      // Calculate estimated tax using progressive brackets
      const { totalTax: estimatedTax, breakdown } = calculateProgressiveTax(
        taxableIncome,
        brackets
      )

      // Get all payments for this year
      const payments = await db
        .select()
        .from(incomeTaxPayments)
        .where(
          and(
            eq(incomeTaxPayments.userId, userId),
            eq(incomeTaxPayments.year, year)
          )
        )

      let totalPaid = 0
      let totalPending = 0

      for (const payment of payments) {
        const amount = parseFloat(payment.amount)
        if (payment.status === 'paid') {
          totalPaid += amount
        } else {
          totalPending += amount
        }
      }

      const remaining = Math.max(0, estimatedTax - totalPaid - totalPending)

      return {
        year,
        estimatedTax: estimatedTax.toFixed(2),
        taxableIncome: taxableIncome.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        deductionRate: deductionRate.toFixed(2),
        additionalTaxableIncome: additionalTaxableIncome.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalPending: totalPending.toFixed(2),
        remaining: remaining.toFixed(2),
        brackets: breakdown,
      }
    }
  )
}
