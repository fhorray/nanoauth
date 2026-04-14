import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.middleware'
import type { User } from 'nanoauth'

export const apiRoutes = new Hono<{
  Variables: {
    user: User
  }
}>()

// Protect all routes in this group
apiRoutes.use('*', authMiddleware)

// Get current user profile
apiRoutes.get('/me', (c) => {
  const user = c.get('user')
  return c.json({
    message: 'This is protected data!',
    user
  })
})

// Get system stats
apiRoutes.get('/stats', (c) => {
  return c.json({
    activeUsers: 42,
    securityLevel: 'High (HS256)',
    system: 'NanoAuth Playground'
  })
})
