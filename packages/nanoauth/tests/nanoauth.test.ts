import { expect, test, describe, mock } from 'bun:test'
import { createAuth, nanoauth } from '../src/core'
import type { AuthAdapter, Plugin } from '../src/types'

describe('NanoAuth Declarative Factory', () => {
  const dummyAdapter: AuthAdapter = {
    getUser: mock(async (id) => ({ id, email: 'test@example.com', name: 'Test', role: 'user' })),
    saveSession: mock(async () => { }),
    validateToken: mock(async () => true),
    deleteSession: mock(async () => { })
  }

  test('should load plugins automatically', async () => {
    let setupCalled = false
    const myPlugin: Plugin = {
      name: 'test-plugin',
      setup: () => { setupCalled = true }
    }

    nanoauth({
      adapter: dummyAdapter,
      plugins: [myPlugin]
    })

    expect(setupCalled).toBe(true)
  })

  test('should register global event hooks', async () => {
    let eventData: any = null
    const auth = createAuth(dummyAdapter) as any

    auth.on('afterLogin', (data: any) => { eventData = data })
    auth.emit('afterLogin', { user: { id: '1' }, token: 'abc' })
    expect(eventData).toEqual({ user: { id: '1' }, token: 'abc' })
  })

  describe('Database Interceptors (Hooks)', () => {
    test('should intercept getUser and call next()', async () => {
      let intercepted = false
      const auth = nanoauth({
        adapter: dummyAdapter,
        hooks: {
          onGetUser: async (id, next) => {
            intercepted = true
            return next(id)
          }
        }
      }) as any

      const user = await auth.adapter.getUser('123')
      expect(intercepted).toBe(true)
      expect(user.id).toBe('123')
      expect(dummyAdapter.getUser).toHaveBeenCalled()
    })

    test('should allow mutating data before calling next()', async () => {
      const auth = nanoauth({
        adapter: dummyAdapter,
        hooks: {
          onGetUser: async (id, next) => {
            return next('mutated-id')
          }
        }
      })

      await auth.adapter.getUser('original-id')
      expect(dummyAdapter.getUser).toHaveBeenCalledWith('mutated-id')
    })

    test('should throw error if next() is NOT called', async () => {
      const auth = nanoauth({
        adapter: dummyAdapter,
        hooks: {
          onGetUser: async (id, next) => {
            // Esqueceu de chamar next()
            return null as any
          }
        }
      })

      expect(auth.adapter.getUser('123')).rejects.toThrow(
        /Interceptor hook 'onGetUser' finished execution without calling next\(\)/
      )
    })

    test('should properly handle async hooks with next()', async () => {
      let order: string[] = []
      const auth = nanoauth({
        adapter: dummyAdapter,
        hooks: {
          onSaveSession: async (id, data, next) => {
            order.push('before')
            await next(id, data)
            order.push('after')
          }
        }
      })

      await auth.adapter.saveSession('sess_1', {})
      expect(order).toEqual(['before', 'after'])
    })
  })
})
