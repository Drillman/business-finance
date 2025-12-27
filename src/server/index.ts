import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { authRoutes } from './routes/auth'
import { passkeyRoutes } from './routes/passkeys'
import { invoiceRoutes } from './routes/invoices'
import { expenseRoutes } from './routes/expenses'
import { settingsRoutes } from './routes/settings'
import { tvaRoutes } from './routes/tva'
import { urssafRoutes } from './routes/urssaf'
import { dashboardRoutes } from './routes/dashboard'
import { accountRoutes } from './routes/account'
import { incomeTaxRoutes } from './routes/income-tax'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isProduction = process.env.NODE_ENV === 'production'

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
  await fastify.register(dashboardRoutes)
  await fastify.register(accountRoutes)
  await fastify.register(incomeTaxRoutes)

  // Serve static files in production
  if (isProduction) {
    const clientPath = path.join(__dirname, '../client')

    await fastify.register(fastifyStatic, {
      root: clientPath,
      prefix: '/',
    })

    // SPA fallback: serve index.html for non-API routes
    fastify.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api')) {
        return reply.sendFile('index.html')
      }
      return reply.status(404).send({ error: 'Not found' })
    })
  }

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
