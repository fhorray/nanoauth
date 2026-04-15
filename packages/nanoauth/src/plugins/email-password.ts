import { generateId as createID, hashSHA256, encodeHex, createHS256JWT } from '../utils'
import type { AuthCoreInstance, Credentials, Plugin, SignupData, User } from '../types'
import { NanoAuthError } from '../errors'
import { definePlugin } from '../utils'

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
export const emailPasswordPlugin = definePlugin(<TUser extends User = User>(config: EmailPasswordConfig<TUser>) => {
  return {
    name: 'email-password',

    exports: (auth: AuthCoreInstance<TUser>) => {
      return {
        signin: {
          email: async (emailOrData: string | Credentials, password?: string): Promise<{ user: TUser, token: string }> => {
            let email: string, pwd: string;

            if (typeof emailOrData === 'string') {
              email = emailOrData;
              pwd = password!;
            } else {
              email = emailOrData.email;
              pwd = emailOrData.password;
            }

            try {
              auth.emit('beforeLogin', { email })

              const secretStr = (auth as any).config?.secret;
              const secretBytes = secretStr ? new TextEncoder().encode(secretStr) : new Uint8Array();

              const compareFn = config.comparePassword ? config.comparePassword : async (pwd: string, hash: string) => {
                return encodeHex(hashSHA256(new TextEncoder().encode(pwd))) === hash;
              };

              const generateTokenFn = config.generateToken ? config.generateToken : async (user: TUser) => {
                if (!secretStr) {
                  throw new NanoAuthError('A "secret" is required in nanoauth options to use the default token generation.');
                }
                return createHS256JWT(
                  { userId: user.id, email: user.email },
                  secretBytes,
                  { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) }
                );
              };

              if (config.validateEmail && !config.validateEmail(email)) {
                throw new Error('Invalid email')
              }

              const user = await config.userRepository.findByEmail(email)
              if (!user) {
                throw new Error('User not found')
              }

              const isValid = await compareFn(pwd, (user as any).password)
              if (!isValid) {
                throw new Error('Invalid credentials')
              }

              const token = await generateTokenFn(user as TUser)
              
              auth.emit('afterSignin', { user, token })
              return { user, token }
            } catch (error) {
              auth.emit('onError', error)
              throw error
            }
          }
        },
        signup: {
          email: async (emailOrData: string | SignupData, password?: string, name?: string): Promise<{ user: TUser, token: string }> => {
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
              auth.emit('beforeSignup', { email, name: userName })

              const secretStr = (auth as any).config?.secret;
              const secretBytes = secretStr ? new TextEncoder().encode(secretStr) : new Uint8Array();

              const hashFn = config.hashPassword ? config.hashPassword : async (pwd: string) => {
                return encodeHex(hashSHA256(new TextEncoder().encode(pwd)));
              };

              const generateTokenFn = config.generateToken ? config.generateToken : async (user: TUser) => {
                if (!secretStr) {
                  throw new NanoAuthError('A "secret" is required in nanoauth options to use the default token generation.');
                }
                return createHS256JWT(
                  { userId: user.id, email: user.email },
                  secretBytes,
                  { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) }
                );
              };

              if (config.validateEmail && !config.validateEmail(email)) {
                throw new Error('Invalid email')
              }

              if (config.validatePassword && !config.validatePassword(pwd)) {
                throw new Error('Password does not meet requirements')
              }

              const exists = await config.userRepository.findByEmail(email)
              if (exists) {
                throw new Error('Email already exists')
              }

              const passwordHash = await hashFn(pwd)

              const newUser = await config.userRepository.create({
                id: createID(),
                email,
                name: userName,
                password: passwordHash,
                createdAt: new Date()
              } as any)

              const token = await generateTokenFn(newUser as TUser)

              auth.emit('afterSignup', { user: newUser, token })
              return { user: newUser, token }
            } catch (error) {
              auth.emit('onError', error)
              throw error
            }
          }
        },
        changePassword: async (emailOrData: string | any, oldPassword?: string, newPassword?: string): Promise<boolean> => {
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
            const compareFn = config.comparePassword ? config.comparePassword : async (pwd: string, hash: string) => {
              return encodeHex(hashSHA256(new TextEncoder().encode(pwd))) === hash;
            };
            const hashFn = config.hashPassword ? config.hashPassword : async (pwd: string) => {
              return encodeHex(hashSHA256(new TextEncoder().encode(pwd)));
            };

            const user = await config.userRepository.findByEmail(email)
            if (!user) {
              throw new Error('User not found')
            }

            const isValid = await compareFn(oldPwd, (user as any).password)
            if (!isValid) {
              throw new Error('Invalid password')
            }

            const newHash = await hashFn(newPwd)
            await config.userRepository.updatePassword(user.id, newHash)

            auth.emit('afterPasswordChange', { user })
            return true
          } catch (error) {
            auth.emit('onError', error)
            throw error
          }
        },
        resetPassword: async (emailOrData: string | any, newPassword?: string): Promise<boolean> => {
          let email: string, newPwd: string;

          if (typeof emailOrData === 'string') {
            email = emailOrData;
            newPwd = newPassword!;
          } else {
            email = emailOrData.email;
            newPwd = emailOrData.newPassword;
          }

          try {
            const hashFn = config.hashPassword ? config.hashPassword : async (pwd: string) => {
              return encodeHex(hashSHA256(new TextEncoder().encode(pwd)));
            };

            const user = await config.userRepository.findByEmail(email)
            if (!user) {
              throw new Error('User not found')
            }

            const newHash = await hashFn(newPwd)
            await config.userRepository.updatePassword(user.id, newHash)

            auth.emit('afterPasswordReset', { user })
            return true
          } catch (error) {
            auth.emit('onError', error)
            throw error
          }
        }
      };
    }
  }
});
