import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, refreshTokens, settings } from '../db/schema'
import { hashPassword, verifyPassword } from '../auth/password'
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  type TokenPayload,
} from '../auth/jwt'
import { requireAuth } from '../auth/middleware'

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = registerSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        message: parseResult.error.issues[0].message,
      })
    }

    const { email, password } = parseResult.data

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    })

    if (existingUser) {
      return reply.status(409).send({ message: 'Un compte avec cet email existe déjà' })
    }

    // Create user
    const passwordHash = await hashPassword(password)
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
      })
      .returning()

    // Create default settings for user
    await db.insert(settings).values({
      userId: newUser.id,
    })

    // Generate tokens
    const payload: TokenPayload = { userId: newUser.id, email: newUser.email }
    const accessToken = generateAccessToken(fastify, payload)
    const refreshToken = generateRefreshToken()

    // Store refresh token
    await db.insert(refreshTokens).values({
      userId: newUser.id,
      token: refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    })

    // Set cookies
    reply.setCookie('accessToken', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60, // 15 minutes
    })
    reply.setCookie('refreshToken', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.updatedAt.toISOString(),
      },
      accessToken,
    }
  })

  // Login
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        message: parseResult.error.issues[0].message,
      })
    }

    const { email, password } = parseResult.data

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    })

    if (!user || !user.passwordHash) {
      return reply.status(401).send({ message: 'Email ou mot de passe incorrect' })
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return reply.status(401).send({ message: 'Email ou mot de passe incorrect' })
    }

    // Generate tokens
    const payload: TokenPayload = { userId: user.id, email: user.email }
    const accessToken = generateAccessToken(fastify, payload)
    const refreshToken = generateRefreshToken()

    // Store refresh token
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    })

    // Set cookies
    reply.setCookie('accessToken', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60,
    })
    reply.setCookie('refreshToken', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      accessToken,
    }
  })

  // Logout
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken

    if (refreshToken) {
      // Delete refresh token from database
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken))
    }

    // Clear cookies
    reply.clearCookie('accessToken', COOKIE_OPTIONS)
    reply.clearCookie('refreshToken', COOKIE_OPTIONS)

    return reply.status(204).send()
  })

  // Refresh token
  fastify.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken

    if (!refreshToken) {
      return reply.status(401).send({ message: 'Token de rafraîchissement manquant' })
    }

    // Find and validate refresh token
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken),
    })

    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Clear cookies if token is invalid or expired
      reply.clearCookie('accessToken', COOKIE_OPTIONS)
      reply.clearCookie('refreshToken', COOKIE_OPTIONS)
      return reply.status(401).send({ message: 'Token de rafraîchissement invalide ou expiré' })
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, storedToken.userId),
    })

    if (!user) {
      return reply.status(401).send({ message: 'Utilisateur non trouvé' })
    }

    // Delete old refresh token
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken))

    // Generate new tokens
    const payload: TokenPayload = { userId: user.id, email: user.email }
    const newAccessToken = generateAccessToken(fastify, payload)
    const newRefreshToken = generateRefreshToken()

    // Store new refresh token
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: getRefreshTokenExpiry(),
    })

    // Set cookies
    reply.setCookie('accessToken', newAccessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60,
    })
    reply.setCookie('refreshToken', newRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      accessToken: newAccessToken,
    }
  })

  // Get current user
  fastify.get(
    '/api/auth/me',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, request.authUser.userId),
      })

      if (!user) {
        return reply.status(404).send({ message: 'Utilisateur non trouvé' })
      }

      return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }
    }
  )
}
