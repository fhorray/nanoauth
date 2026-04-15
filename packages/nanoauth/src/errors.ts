/**
 * NanoAuth - Error Classes
 * 
 * Provides specific error types to distinguish between
 * authentication failures, validation issues, and security violations.
 */

export class NanoAuthError extends Error {
  public status: number = 400;
  public code?: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = 'NanoAuthError';
    this.status = options.status || 400;
    this.code = options.code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends NanoAuthError {
  constructor(message: string = 'Authentication failed') {
    super(message, { status: 401, code: 'AUTH_FAILED' });
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends NanoAuthError {
  constructor(message: string = 'Validation failed') {
    super(message, { status: 400, code: 'VALIDATION_FAILED' });
    this.name = 'ValidationError';
  }
}

export class SecurityError extends NanoAuthError {
  constructor(message: string = 'Security violation detected') {
    super(message, { status: 403, code: 'SECURITY_VIOLATION' });
    this.name = 'SecurityError';
  }
}

/**
 * NanoAuthErrorFactory
 * 
 * Dynamically creates a custom error class for plugins.
 */
export function NanoAuthErrorFactory(name: string, defaultStatus: number = 400, defaultCode?: string) {
  return class extends NanoAuthError {
    constructor(message: string, options: { status?: number; code?: string } = {}) {
      super(message, { 
        status: options.status || defaultStatus, 
        code: options.code || defaultCode 
      });
      this.name = name;
    }
  };
}

