import { generateId as createID, encodeBase64 } from '../utils'
import type { AuthCoreInstance, Credentials, Plugin, SignupData, User } from '../types'

export interface EmailPasswordConfig<TUser extends User = User> {
  validateEmail?: (email: string) => boolean
  validatePassword?: (password: string) => boolean
  hashPassword?: (password: string) => Promise<string>
  comparePassword?: (password: string, hash: string) => Promise<boolean>
  userRepository: {
    findByEmail(email: string): Promise<TUser | null>
    create(user: TUser): Promise<TUser>
    update(id: string, data: Partial<TUser>): Promise<TUser>
    updatePassword(userId: string, hash: string): Promise<void>
    [key: string]: any
  }
  generateToken?: (user: TUser) => string | Promise<string>
}

/**
 * Plugin for authentication by email and password
 */
export function emailPasswordPlugin<TUser extends User = User>(config: EmailPasswordConfig<TUser>): Plugin<TUser> {
  return {
    name: 'email-password',

    async setup(auth: AuthCoreInstance<TUser>) {
      // Login method
      auth.login = async (emailOrData: string | Credentials, password?: string) => {
        // Handle both calling styles: login(email, password) or login({email, password})
        let email: string, pwd: string;

        if (typeof emailOrData === 'string') {
          email = emailOrData;
          pwd = password!;
        } else {
          email = emailOrData.email;
          pwd = emailOrData.password;
        }

        try {
          auth.setState('isLoading', true)
          auth.emit('beforeLogin', { email })

          // Validate email
          if (config.validateEmail && !config.validateEmail(email)) {
            throw new Error('Invalid email')
          }

          // Find user
          const user = await config.userRepository.findByEmail(email)
          if (!user) {
            throw new Error('User not found')
          }

          // Validate password
          if (!config.comparePassword) {
            throw new Error('comparePassword function not provided')
          }

          const isValid = await config.comparePassword(pwd, (user as any).password)
          if (!isValid) {
            throw new Error('Invalid credentials')
          }

          // Generate token
          const token = await (config.generateToken?.(user) ?? generateSimpleToken(user))

          // Update state
          auth.setState('user', user)
          auth.setState('token', token)
          auth.setState('error', null)
          auth.setState('isLoading', false)

          auth.emit('afterSignin', { user, token })
          return user
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          auth.emit('onError', error)
          throw error
        }
      }

      // Signup method
      auth.signup = async (emailOrData: string | SignupData, password?: string, name?: string) => {
        // Handle both calling styles: signup(email, password, name) or signup({email, password, name})
        let email: string, pwd: string, userName: string;

        if (typeof emailOrData === 'string') {
          email = emailOrData;
          pwd = password!;
          userName = name!;
        } else {
          email = emailOrData.email;
          pwd = emailOrData.password;
          userName = emailOrData.name;
        }

        try {
          auth.setState('isLoading', true)
          auth.emit('beforeSignup', { email, name: userName })

          // Validate email
          if (config.validateEmail && !config.validateEmail(email)) {
            throw new Error('Invalid email')
          }

          // Validate password
          if (config.validatePassword && !config.validatePassword(pwd)) {
            throw new Error('Password does not meet requirements')
          }

          // Check if email already exists
          const exists = await config.userRepository.findByEmail(email)
          if (exists) {
            throw new Error('Email already exists')
          }

          // Hash password
          if (!config.hashPassword) {
            throw new Error('hashPassword function not provided')
          }

          const passwordHash = await config.hashPassword(pwd)

          // Create user
          const newUser = await config.userRepository.create({
            id: createID(),
            email,
            name: userName,
            password: passwordHash,
            createdAt: new Date()
          } as any)

          // Generate token
          const token = await (config.generateToken?.(newUser) ?? generateSimpleToken(newUser))

          // Update state
          auth.setState('user', newUser)
          auth.setState('token', token)
          auth.setState('error', null)
          auth.setState('isLoading', false)

          auth.emit('afterSignup', { user: newUser, token })
          return newUser
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          auth.emit('onError', error)
          throw error
        }
      }

      // Change password method
      auth.changePassword = async (
        emailOrData: string | any,
        oldPassword?: string,
        newPassword?: string
      ) => {
        let email: string, oldPwd: string, newPwd: string;

        if (typeof emailOrData === 'string') {
          email = emailOrData;
          oldPwd = oldPassword!;
          newPwd = newPassword!;
        } else {
          email = emailOrData.email;
          oldPwd = emailOrData.oldPassword;
          newPwd = emailOrData.newPassword;
        }

        try {
          auth.setState('isLoading', true)

          // Find user
          const user = await config.userRepository.findByEmail(email)
          if (!user) {
            throw new Error('User not found')
          }

          // Validate old password
          if (!config.comparePassword) {
            throw new Error('comparePassword function not provided')
          }

          const isValid = await config.comparePassword(oldPwd, (user as any).password)
          if (!isValid) {
            throw new Error('Invalid password')
          }

          // Hash new password
          if (!config.hashPassword) {
            throw new Error('hashPassword function not provided')
          }

          const newHash = await config.hashPassword(newPwd)
          await config.userRepository.updatePassword(user.id, newHash)

          auth.setState('error', null)
          auth.setState('isLoading', false)
          auth.emit('afterPasswordChange', { user })
          return true
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          auth.emit('onError', error)
          throw error
        }
      }

      // Reset password method
      auth.resetPassword = async (emailOrData: string | any, newPassword?: string) => {
        let email: string, newPwd: string;

        if (typeof emailOrData === 'string') {
          email = emailOrData;
          newPwd = newPassword!;
        } else {
          email = emailOrData.email;
          newPwd = emailOrData.newPassword;
        }

        try {
          auth.setState('isLoading', true)

          // Find user
          const user = await config.userRepository.findByEmail(email)
          if (!user) {
            throw new Error('User not found')
          }

          // Hash new password
          if (!config.hashPassword) {
            throw new Error('hashPassword function not provided')
          }

          const newHash = await config.hashPassword(newPwd)
          await config.userRepository.updatePassword(user.id, newHash)

          auth.setState('error', null)
          auth.setState('isLoading', false)
          auth.emit('afterPasswordReset', { user })
          return true
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          auth.emit('onError', error)
          throw error
        }
      }
    }
  }
}

/**
 * Generate simple token
 */
function generateSimpleToken(user: User): string {
  const payload = JSON.stringify({ userId: user.id, timestamp: Date.now() });
  return encodeBase64(new TextEncoder().encode(payload));
}
