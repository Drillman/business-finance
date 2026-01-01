import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { settings, taxBrackets, yearlyRates } from '../db/schema'
import { and } from 'drizzle-orm'
import { requireAuth } from '../auth/middleware'

const updateSettingsSchema = z.object({
  urssafRate: z.number().min(0).max(100).optional(),
  estimatedTaxRate: z.number().min(0).max(100).optional(),
  revenueDeductionRate: z.number().min(0).max(100).optional(),
  monthlySalary: z.number().min(0).optional(),
  additionalTaxableIncome: z.number().min(0).optional(),
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

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get user settings
  fastify.get(
    '/api/settings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const userId = request.authUser.userId

      let userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })

      // Create default settings if none exist
      if (!userSettings) {
        const [created] = await db
          .insert(settings)
          .values({ userId })
          .returning()
        userSettings = created
      }

      return userSettings
    }
  )

  // Update user settings
  fastify.put(
    '/api/settings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateSettingsSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const userId = request.authUser.userId
      const data = parseResult.data

      // Ensure settings exist
      let userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })

      if (!userSettings) {
        const [created] = await db
          .insert(settings)
          .values({ userId })
          .returning()
        userSettings = created
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (data.urssafRate !== undefined) {
        updateData.urssafRate = data.urssafRate.toFixed(2)
      }
      if (data.estimatedTaxRate !== undefined) {
        updateData.estimatedTaxRate = data.estimatedTaxRate.toFixed(2)
      }
      if (data.revenueDeductionRate !== undefined) {
        updateData.revenueDeductionRate = data.revenueDeductionRate.toFixed(2)
      }
      if (data.monthlySalary !== undefined) {
        updateData.monthlySalary = data.monthlySalary.toFixed(2)
      }
      if (data.additionalTaxableIncome !== undefined) {
        updateData.additionalTaxableIncome = data.additionalTaxableIncome.toFixed(2)
      }

      const [updated] = await db
        .update(settings)
        .set(updateData)
        .where(eq(settings.userId, userId))
        .returning()

      return updated
    }
  )

  // Get tax brackets for a year
  fastify.get(
    '/api/settings/tax-brackets',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        year: z.coerce.number().min(2000).max(2100).default(new Date().getFullYear()),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year } = parseResult.data
      const userId = request.authUser.userId

      // First try to get user's custom brackets for this year
      let brackets = await db
        .select()
        .from(taxBrackets)
        .where(eq(taxBrackets.userId, userId))
        .orderBy(taxBrackets.minIncome)

      // Filter by year if we have brackets
      brackets = brackets.filter((b) => b.year === year)

      // If no custom brackets, try to get default (official) brackets
      if (brackets.length === 0) {
        const defaultBrackets = await db
          .select()
          .from(taxBrackets)
          .where(eq(taxBrackets.year, year))
          .orderBy(taxBrackets.minIncome)

        // Filter for official brackets (userId is null)
        brackets = defaultBrackets.filter((b) => b.userId === null)
      }

      // If still no brackets, seed the default 2025 brackets and return them
      if (brackets.length === 0 && year === 2025) {
        const seeded = await db
          .insert(taxBrackets)
          .values(
            DEFAULT_TAX_BRACKETS_2025.map((bracket) => ({
              userId: null,
              year: 2025,
              minIncome: bracket.minIncome.toFixed(2),
              maxIncome: bracket.maxIncome?.toFixed(2) ?? null,
              rate: bracket.rate.toFixed(2),
              isCustom: false,
            }))
          )
          .returning()

        return { year, brackets: seeded, isCustom: false }
      }

      return {
        year,
        brackets,
        isCustom: brackets.length > 0 && brackets[0].userId !== null,
      }
    }
  )

  // Set custom tax brackets for a year
  fastify.post(
    '/api/settings/tax-brackets',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        year: z.number().min(2000).max(2100),
        brackets: z.array(
          z.object({
            minIncome: z.number().min(0),
            maxIncome: z.number().nullable(),
            rate: z.number().min(0).max(100),
          })
        ).min(1),
      })

      const parseResult = bodySchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, brackets: newBrackets } = parseResult.data
      const userId = request.authUser.userId

      // Delete existing custom brackets for this user/year
      await db
        .delete(taxBrackets)
        .where(eq(taxBrackets.userId, userId))

      // Insert new brackets
      const inserted = await db
        .insert(taxBrackets)
        .values(
          newBrackets.map((bracket) => ({
            userId,
            year,
            minIncome: bracket.minIncome.toFixed(2),
            maxIncome: bracket.maxIncome?.toFixed(2) ?? null,
            rate: bracket.rate.toFixed(2),
            isCustom: true,
          }))
        )
        .returning()

      return reply.status(201).send({
        year,
        brackets: inserted,
        isCustom: true,
      })
    }
  )

  // Reset to official tax brackets (delete custom)
  fastify.delete(
    '/api/settings/tax-brackets',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser.userId

      await db
        .delete(taxBrackets)
        .where(eq(taxBrackets.userId, userId))

      return reply.status(204).send()
    }
  )

  // Get yearly rates (URSSAF and estimated tax rate)
  fastify.get(
    '/api/settings/yearly-rates',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        year: z.coerce.number().min(2000).max(2100).default(new Date().getFullYear()),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year } = parseResult.data
      const userId = request.authUser.userId

      // Try to get rates for this year
      const rates = await db.query.yearlyRates.findFirst({
        where: and(
          eq(yearlyRates.userId, userId),
          eq(yearlyRates.year, year)
        ),
      })

      // If no rates for this year, get from general settings as default
      if (!rates) {
        const userSettings = await db.query.settings.findFirst({
          where: eq(settings.userId, userId),
        })

        return {
          year,
          urssafRate: userSettings?.urssafRate ?? '22.00',
          estimatedTaxRate: userSettings?.estimatedTaxRate ?? '11.00',
          isCustom: false,
        }
      }

      return {
        year,
        urssafRate: rates.urssafRate,
        estimatedTaxRate: rates.estimatedTaxRate,
        isCustom: true,
      }
    }
  )

  // Set yearly rates
  fastify.post(
    '/api/settings/yearly-rates',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        year: z.number().min(2000).max(2100),
        urssafRate: z.number().min(0).max(100),
        estimatedTaxRate: z.number().min(0).max(100),
      })

      const parseResult = bodySchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, urssafRate, estimatedTaxRate } = parseResult.data
      const userId = request.authUser.userId

      // Check if rates exist for this year
      const existing = await db.query.yearlyRates.findFirst({
        where: and(
          eq(yearlyRates.userId, userId),
          eq(yearlyRates.year, year)
        ),
      })

      if (existing) {
        // Update existing rates
        const [updated] = await db
          .update(yearlyRates)
          .set({
            urssafRate: urssafRate.toFixed(2),
            estimatedTaxRate: estimatedTaxRate.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(yearlyRates.id, existing.id))
          .returning()

        return {
          year,
          urssafRate: updated.urssafRate,
          estimatedTaxRate: updated.estimatedTaxRate,
          isCustom: true,
        }
      }

      // Insert new rates
      const [inserted] = await db
        .insert(yearlyRates)
        .values({
          userId,
          year,
          urssafRate: urssafRate.toFixed(2),
          estimatedTaxRate: estimatedTaxRate.toFixed(2),
        })
        .returning()

      return reply.status(201).send({
        year,
        urssafRate: inserted.urssafRate,
        estimatedTaxRate: inserted.estimatedTaxRate,
        isCustom: true,
      })
    }
  )

  // Delete yearly rates (reset to defaults)
  fastify.delete(
    '/api/settings/yearly-rates',
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

      await db
        .delete(yearlyRates)
        .where(and(
          eq(yearlyRates.userId, userId),
          eq(yearlyRates.year, year)
        ))

      return reply.status(204).send()
    }
  )

  // Calculate estimated income tax
  fastify.post(
    '/api/settings/calculate-tax',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        annualRevenue: z.number().min(0),
        year: z.number().min(2000).max(2100).default(new Date().getFullYear()),
      })

      const parseResult = bodySchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { annualRevenue, year } = parseResult.data
      const userId = request.authUser.userId

      // Get user settings for deduction rate
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })

      const deductionRate = userSettings
        ? parseFloat(userSettings.revenueDeductionRate)
        : 34

      // Calculate taxable income
      const taxableIncome = annualRevenue * (1 - deductionRate / 100)

      // Get brackets (prefer custom, fallback to official)
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

      // Calculate progressive tax
      let totalTax = 0
      const breakdown: { bracket: string; income: number; rate: number; tax: number }[] = []

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
            bracket: bracket.maxIncome
              ? `${minIncome.toFixed(0)} - ${maxIncome.toFixed(0)}`
              : `> ${minIncome.toFixed(0)}`,
            income: Math.round(incomeInBracket),
            rate,
            tax: Math.round(taxForBracket),
          })
        }
      }

      return {
        annualRevenue: annualRevenue.toFixed(2),
        deductionRate: deductionRate.toFixed(2),
        taxableIncome: taxableIncome.toFixed(2),
        estimatedTax: totalTax.toFixed(2),
        effectiveRate: taxableIncome > 0
          ? ((totalTax / taxableIncome) * 100).toFixed(2)
          : '0.00',
        breakdown,
      }
    }
  )
}
