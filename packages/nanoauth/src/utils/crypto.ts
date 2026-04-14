import { SHA256, sha256 } from "@oslojs/crypto/sha2";
import { hmac } from "@oslojs/crypto/hmac";
import { constantTimeEqual } from "@oslojs/crypto/subtle";
import { encodeHexLowerCase } from "@oslojs/encoding";

/**
 * Generate secure random bytes using the platform's native RNG
 */
export const generateRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  // Use global crypto (available in Bun, Node 19+, and Browser)
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Generate a secure random string (hex)
 */
export const generateId = (length: number = 32): string => {
  const bytes = generateRandomBytes(Math.ceil(length / 2));
  return encodeHexLowerCase(bytes).slice(0, length);
};

/**
 * Compute SHA256 hash
 */
export const hashSHA256 = (data: Uint8Array): Uint8Array => {
  return sha256(data);
};

/**
 * Constant time equality check to prevent timing attacks
 */
export const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  return constantTimeEqual(a, b);
};

/**
 * Compute HMAC-SHA256
 */
export const computeHMAC256 = (key: Uint8Array, data: Uint8Array): Uint8Array => {
  return hmac(SHA256, key, data);
};
