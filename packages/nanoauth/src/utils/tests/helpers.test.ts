import { describe, it, expect, mock } from 'bun:test'
import { createPlugin, defineAdapter, definePlugin } from '../helpers'
import { User, AuthCoreInstance } from '../../types'

describe('Developer Experience Helpers', () => {
  describe('defineAdapter', () => {
    it('should return the passed adapter unmodified at runtime', () => {
      const myAdapter = defineAdapter({
        getUser: async () => null,
        saveSession: async () => { },
        validateToken: async () => true,
        deleteSession: async () => { },
        myCustomMethod: () => 'hello'
      })

      expect(myAdapter.myCustomMethod()).toBe('hello')
      expect(typeof myAdapter.getUser).toBe('function')
    })

    // Type-level tests (these will fail type check if the signature is wrong, 
    // but we test logic here)
    it('should infer custom properties in the return type', () => {
      interface CustomUser extends User {
        role: 'admin'
      }

      const adapter = defineAdapter<CustomUser>({
        getUser: async (id) => ({ id, email: 'e', name: 'n', role: 'admin' }),
        saveSession: async () => { },
        validateToken: async () => true,
        deleteSession: async () => { },
        findUsersByRole: async (role: string) => []
      })

      expect(typeof adapter.findUsersByRole).toBe('function')
    })
  })

  describe('definePlugin', () => {
    it('should return the factory function unmodified', () => {
      const pluginFactory = definePlugin<{ magicWord: string }>((options) => ({
        name: 'magic',
        setup(auth: AuthCoreInstance) {
          auth.magicWord = options.magicWord
        }
      }))

      const plugin = pluginFactory({ magicWord: 'abracadabra' })

      expect(plugin.name).toBe('magic')
      expect(typeof plugin.setup).toBe('function')

      // Mock auth instance to test setup
      const mockAuth = {} as AuthCoreInstance
      plugin.setup(mockAuth)

      expect((mockAuth as any).magicWord).toBe('abracadabra')
    })
  })

  describe('createPlugin', () => {
    it('should return the plugin definition unmodified', () => {
      const setupMock = mock(() => { })
      const simplePlugin = createPlugin({
        name: 'simple',
        setup: setupMock
      })

      expect(simplePlugin.name).toBe('simple')
      expect(typeof simplePlugin.setup).toBe('function')

      const mockAuth = {} as AuthCoreInstance
      simplePlugin.setup(mockAuth)

      expect(setupMock).toHaveBeenCalledWith(mockAuth)
    })
  })
})