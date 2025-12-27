import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'

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

  // Security: Rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  })

  // Health check route
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

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
