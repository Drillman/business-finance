import type { FastifyInstance, FastifyRequest } from 'fastify'
import crypto from 'crypto'

export interface TokenPayload {
  userId: string
  email: string
}

export interface DecodedToken extends TokenPayload {
  iat: number
  exp: number
}

export function registerJwtPlugin(fastify: FastifyInstance) {
  fastify.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    sign: {
      expiresIn: '15m',
    },
  })
}

export function generateAccessToken(fastify: FastifyInstance, payload: TokenPayload): string {
  return fastify.jwt.sign(payload)
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

export async function verifyAccessToken(
  request: FastifyRequest
): Promise<DecodedToken> {
  return request.jwtVerify<DecodedToken>()
}

export function getRefreshTokenExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 7) // 7 days
  return expiry
}
