import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { users, passkeys, refreshTokens, settings } from '../db/schema'
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  type StoredPasskey,
} from '../auth/webauthn'
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  type TokenPayload,
} from '../auth/jwt'
import { requireAuth } from '../auth/middleware'

// In-memory challenge store (use Redis in production for multi-instance deployments)
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>()

function storeChallenge(key: string, challenge: string): void {
  challengeStore.set(key, {
    challenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  })
}

function getChallenge(key: string): string | null {
  const stored = challengeStore.get(key)
  if (!stored || stored.expiresAt < Date.now()) {
    challengeStore.delete(key)
    return null
  }
  challengeStore.delete(key)
  return stored.challenge
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

export async function passkeyRoutes(fastify: FastifyInstance) {
  // Generate registration options for adding a passkey (authenticated user)
  fastify.post(
    '/api/passkeys/register/options',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const userId = request.authUser.userId
      const userEmail = request.authUser.email

      // Get existing passkeys
      const existingPasskeys = await db.query.passkeys.findMany({
        where: eq(passkeys.userId, userId),
      })

      const storedPasskeys: StoredPasskey[] = existingPasskeys.map((p) => ({
        credentialId: p.credentialId,
        publicKey: p.publicKey,
        counter: p.counter,
        transports: p.transports,
      }))

      const options = await generatePasskeyRegistrationOptions(userId, userEmail, storedPasskeys)

      // Store challenge
      storeChallenge(`register:${userId}`, options.challenge)

      return options
    }
  )

  // Verify registration and save passkey (authenticated user)
  fastify.post(
    '/api/passkeys/register/verify',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser.userId
      const body = request.body as { response: unknown; deviceName?: string }

      const expectedChallenge = getChallenge(`register:${userId}`)
      if (!expectedChallenge) {
        return reply.status(400).send({ message: 'Challenge expiré ou invalide' })
      }

      try {
        const verification = await verifyPasskeyRegistration(
          body.response as Parameters<typeof verifyPasskeyRegistration>[0],
          expectedChallenge
        )

        if (!verification.verified || !verification.registrationInfo) {
          return reply.status(400).send({ message: 'Échec de la vérification' })
        }

        const { credential } = verification.registrationInfo

        // Store passkey
        await db.insert(passkeys).values({
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          deviceName: body.deviceName || 'Passkey',
          transports: credential.transports ? JSON.stringify(credential.transports) : null,
        })

        return { success: true }
      } catch (error) {
        fastify.log.error(error)
        return reply.status(400).send({ message: 'Échec de la vérification du passkey' })
      }
    }
  )

  // Generate authentication options (for login)
  fastify.post('/api/passkeys/authenticate/options', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as { email?: string }

    let allowCredentials: StoredPasskey[] | undefined

    if (body.email) {
      // Find user and their passkeys
      const user = await db.query.users.findFirst({
        where: eq(users.email, body.email.toLowerCase()),
      })

      if (user) {
        const userPasskeys = await db.query.passkeys.findMany({
          where: eq(passkeys.userId, user.id),
        })

        if (userPasskeys.length === 0) {
          return reply.status(400).send({ message: 'Aucun passkey enregistré pour cet utilisateur' })
        }

        allowCredentials = userPasskeys.map((p) => ({
          credentialId: p.credentialId,
          publicKey: p.publicKey,
          counter: p.counter,
          transports: p.transports,
        }))
      }
    }

    const options = await generatePasskeyAuthenticationOptions(allowCredentials)

    // Store challenge with email or 'discoverable' for conditional UI
    const challengeKey = body.email ? `auth:${body.email.toLowerCase()}` : `auth:discoverable:${options.challenge}`
    storeChallenge(challengeKey, options.challenge)

    return options
  })

  // Verify authentication (login with passkey)
  fastify.post('/api/passkeys/authenticate/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as { response: unknown; email?: string }

    // Extract credential ID from response
    const response = body.response as { id: string; rawId: string }
    const credentialId = response.id

    // Find the passkey
    const passkey = await db.query.passkeys.findFirst({
      where: eq(passkeys.credentialId, credentialId),
    })

    if (!passkey) {
      return reply.status(401).send({ message: 'Passkey non reconnu' })
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, passkey.userId),
    })

    if (!user) {
      return reply.status(401).send({ message: 'Utilisateur non trouvé' })
    }

    // Get challenge
    const challengeKey = body.email
      ? `auth:${body.email.toLowerCase()}`
      : `auth:discoverable:${(body.response as { clientDataJSON?: string })?.clientDataJSON || ''}`

    // Try multiple challenge keys for discoverable credentials
    let expectedChallenge = getChallenge(challengeKey)
    if (!expectedChallenge && !body.email) {
      // For discoverable credentials, we stored the challenge with its own value as key
      // We need to iterate stored challenges (this is a simplification)
      for (const [key, value] of challengeStore.entries()) {
        if (key.startsWith('auth:discoverable:')) {
          expectedChallenge = value.challenge
          challengeStore.delete(key)
          break
        }
      }
    }

    if (!expectedChallenge) {
      return reply.status(400).send({ message: 'Challenge expiré ou invalide' })
    }

    try {
      const verification = await verifyPasskeyAuthentication(
        body.response as Parameters<typeof verifyPasskeyAuthentication>[0],
        expectedChallenge,
        {
          credentialId: passkey.credentialId,
          publicKey: passkey.publicKey,
          counter: passkey.counter,
          transports: passkey.transports,
        }
      )

      if (!verification.verified) {
        return reply.status(401).send({ message: 'Échec de la vérification' })
      }

      // Update counter
      await db
        .update(passkeys)
        .set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(passkeys.id, passkey.id))

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      fastify.log.error({ err: error, expectedOrigin: process.env.WEBAUTHN_ORIGIN, expectedRpId: process.env.WEBAUTHN_RP_ID }, 'Passkey authentication error')
      return reply.status(401).send({ message: 'Échec de l\'authentification', debug: errorMessage })
    }
  })

  // List user's passkeys
  fastify.get(
    '/api/passkeys',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const userPasskeys = await db.query.passkeys.findMany({
        where: eq(passkeys.userId, request.authUser.userId),
        columns: {
          id: true,
          deviceName: true,
          createdAt: true,
          lastUsedAt: true,
        },
      })

      return userPasskeys.map((p) => ({
        id: p.id,
        deviceName: p.deviceName,
        createdAt: p.createdAt.toISOString(),
        lastUsedAt: p.lastUsedAt?.toISOString() || null,
      }))
    }
  )

  // Delete a passkey
  fastify.delete(
    '/api/passkeys/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      // Check if user has other auth methods before deleting last passkey
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })

      const userPasskeys = await db.query.passkeys.findMany({
        where: eq(passkeys.userId, userId),
      })

      const hasPassword = !!user?.passwordHash
      const isLastPasskey = userPasskeys.length === 1

      if (isLastPasskey && !hasPassword) {
        return reply.status(400).send({
          message: 'Impossible de supprimer le dernier passkey sans mot de passe configuré',
        })
      }

      await db
        .delete(passkeys)
        .where(and(eq(passkeys.id, id), eq(passkeys.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Rename a passkey
  fastify.patch(
    '/api/passkeys/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const { id } = request.params as { id: string }
      const body = request.body as { deviceName: string }
      const userId = request.authUser.userId

      await db
        .update(passkeys)
        .set({ deviceName: body.deviceName })
        .where(and(eq(passkeys.id, id), eq(passkeys.userId, userId)))

      return { success: true }
    }
  )

  // Generate registration options for new user signup with passkey
  fastify.post('/api/passkeys/signup/options', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email: string }

    if (!body.email) {
      return reply.status(400).send({ message: 'Email requis' })
    }

    const email = body.email.toLowerCase()

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existingUser) {
      return reply.status(409).send({ message: 'Un compte avec cet email existe déjà' })
    }

    // Generate temporary ID for registration
    const tempId = `temp:${email}:${Date.now()}`
    const options = await generatePasskeyRegistrationOptions(tempId, email, [])

    // Store challenge with email
    storeChallenge(`signup:${email}`, options.challenge)

    return options
  })

  // Complete signup with passkey
  fastify.post('/api/passkeys/signup/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email: string; response: unknown; deviceName?: string }

    if (!body.email) {
      return reply.status(400).send({ message: 'Email requis' })
    }

    const email = body.email.toLowerCase()
    const expectedChallenge = getChallenge(`signup:${email}`)

    if (!expectedChallenge) {
      return reply.status(400).send({ message: 'Challenge expiré ou invalide' })
    }

    // Check again if user exists (race condition prevention)
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existingUser) {
      return reply.status(409).send({ message: 'Un compte avec cet email existe déjà' })
    }

    try {
      const verification = await verifyPasskeyRegistration(
        body.response as Parameters<typeof verifyPasskeyRegistration>[0],
        expectedChallenge
      )

      if (!verification.verified || !verification.registrationInfo) {
        return reply.status(400).send({ message: 'Échec de la vérification' })
      }

      const { credential } = verification.registrationInfo

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          passwordHash: null, // Passkey-only user
        })
        .returning()

      // Create default settings
      await db.insert(settings).values({
        userId: newUser.id,
      })

      // Store passkey
      await db.insert(passkeys).values({
        userId: newUser.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        deviceName: body.deviceName || 'Passkey',
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
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
        maxAge: 15 * 60,
      })
      reply.setCookie('refreshToken', refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60,
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
    } catch (error) {
      fastify.log.error(error)
      return reply.status(400).send({ message: 'Échec de la création du compte' })
    }
  })
}
