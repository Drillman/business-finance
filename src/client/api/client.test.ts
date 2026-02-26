import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from './client'

describe('ApiClient', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockResponse(body: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  }

  describe('GET requests', () => {
    it('makes GET request with correct URL', async () => {
      mockResponse({ data: 'test' })
      await api.get('/invoices')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/invoices',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      )
    })

    it('returns parsed JSON response', async () => {
      mockResponse({ id: '1', client: 'Acme' })
      const result = await api.get('/invoices/1')
      expect(result).toEqual({ id: '1', client: 'Acme' })
    })

    it('does not set Content-Type header for GET', async () => {
      mockResponse({})
      await api.get('/test')

      const lastCall = mockFetch.mock.lastCall!
      const headers = lastCall[1].headers as Record<string, string>
      expect(headers['Content-Type']).toBeUndefined()
    })
  })

  describe('POST requests', () => {
    it('sends JSON body', async () => {
      mockResponse({ id: '1' }, 201)
      await api.post('/invoices', { client: 'Acme', amountHt: 1000 })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/invoices',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ client: 'Acme', amountHt: 1000 }),
          credentials: 'include',
        })
      )
    })

    it('sets Content-Type for requests with body', async () => {
      mockResponse({}, 201)
      await api.post('/test', { key: 'value' })

      const lastCall = mockFetch.mock.lastCall!
      const headers = lastCall[1].headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('allows POST without body', async () => {
      mockResponse({})
      await api.post('/logout')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/logout',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      )
    })
  })

  describe('PUT requests', () => {
    it('sends PUT with body', async () => {
      mockResponse({ updated: true })
      await api.put('/invoices/1', { client: 'Updated' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/invoices/1',
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  describe('PATCH requests', () => {
    it('sends PATCH with body', async () => {
      mockResponse({ updated: true })
      await api.patch('/invoices/1', { client: 'Patched' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/invoices/1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })

  describe('DELETE requests', () => {
    it('sends DELETE request', async () => {
      mockResponse(undefined, 204)
      // For 204, it returns undefined
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
      })

      // Reset and set proper mock
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
      })

      await api.delete('/invoices/1')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/invoices/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('error handling', () => {
    it('throws Error with message from API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Le client est requis' }),
      })

      await expect(api.get('/invoices')).rejects.toThrow('Le client est requis')
    })

    it('throws default message when API returns non-JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      })

      await expect(api.get('/test')).rejects.toThrow('Une erreur est survenue')
    })

    it('returns undefined for 204 responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
      })

      const result = await api.delete('/invoices/1')
      expect(result).toBeUndefined()
    })
  })
})
