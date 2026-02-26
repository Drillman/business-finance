import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestApp, createTestToken } from '../test-utils'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from './middleware'

describe('requireAuth middleware', () => {
  let app: FastifyInstance
  let validToken: string

  beforeAll(async () => {
    app = await createTestApp(async (fastify) => {
      fastify.get('/protected', { preHandler: [requireAuth] }, async (request) => {
        return { userId: request.authUser.userId, email: request.authUser.email }
      })
    })
    validToken = createTestToken(app)
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 when no token is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    })
    expect(response.statusCode).toBe(401)
    expect(response.json().message).toBe('Non autorisé')
  })

  it('returns 401 for invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: { accessToken: 'invalid-token' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('sets authUser for valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: { accessToken: validToken },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.userId).toBe('test-user-id')
    expect(body.email).toBe('test@example.com')
  })

  it('sets authUser with custom payload', async () => {
    const customToken = createTestToken(app, {
      userId: 'custom-id',
      email: 'custom@test.com',
    })
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      cookies: { accessToken: customToken },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.userId).toBe('custom-id')
    expect(body.email).toBe('custom@test.com')
  })
})
