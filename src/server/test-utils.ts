import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const TEST_JWT_SECRET = 'test-jwt-secret'

export async function createTestApp(
  registerRoutes: (fastify: FastifyInstance) => Promise<void>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(cookie, { secret: 'test-cookie-secret' })
  await app.register(jwt, {
    secret: TEST_JWT_SECRET,
    sign: { expiresIn: '15m' },
    cookie: { cookieName: 'accessToken', signed: false },
  })

  await registerRoutes(app)
  await app.ready()
  return app
}

export function createTestToken(
  app: FastifyInstance,
  payload: { userId: string; email: string } = {
    userId: 'test-user-id',
    email: 'test@example.com',
  }
): string {
  return app.jwt.sign(payload)
}
