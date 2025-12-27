import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { authRoutes } from './routes/auth'
import { passkeyRoutes } from './routes/passkeys'
import { invoiceRoutes } from './routes/invoices'
import { expenseRoutes } from './routes/expenses'
import { settingsRoutes } from './routes/settings'
import { tvaRoutes } from './routes/tva'
import { urssafRoutes } from './routes/urssaf'

const fastify = Fastify({
  logger: true,
})

async function start() {
  // Security: Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  })

  // Security: CORS configuration
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })

  // Security: Cookie handling
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  })

  // JWT plugin
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    sign: {
      expiresIn: '15m',
    },
    cookie: {
      cookieName: 'accessToken',
      signed: false,
    },
  })

  // Security: Global rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  })

  // Health check route
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Register routes
  await fastify.register(authRoutes)
  await fastify.register(passkeyRoutes)
  await fastify.register(invoiceRoutes)
  await fastify.register(expenseRoutes)
  await fastify.register(settingsRoutes)
  await fastify.register(tvaRoutes)
  await fastify.register(urssafRoutes)

  // Start server
  const port = parseInt(process.env.PORT || '3000')
  const host = process.env.HOST || '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
