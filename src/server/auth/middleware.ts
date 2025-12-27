import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, type DecodedToken } from './jwt'

declare module 'fastify' {
  interface FastifyRequest {
    authUser: DecodedToken
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await verifyAccessToken(request)
    request.authUser = decoded
  } catch {
    reply.status(401).send({ message: 'Non autorisé' })
  }
}
