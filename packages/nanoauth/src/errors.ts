/**
 * NanoAuth - Error Classes
 * 
 * Provides specific error types to distinguish between
 * authentication failures, validation issues, and security violations.
 */

export class NanoAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NanoAuthError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends NanoAuthError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends NanoAuthError {
  constructor(message: string = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends NanoAuthError {
  constructor(message: string = 'Security violation detected') {
    super(message);
    this.name = 'SecurityError';
  }
}
