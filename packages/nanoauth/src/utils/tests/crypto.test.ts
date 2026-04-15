import { describe, it, expect } from "bun:test";
import {
  generateRandomBytes,
  generateId,
  hashSHA256,
  timingSafeEqual,
  computeHMAC256
} from "../crypto";
import { encodeHex } from "../encoding";

describe("Crypto Utils", () => {
  describe("Randomness", () => {
    it("should generate random bytes of correct length", () => {
      const bytes = generateRandomBytes(32);
      expect(bytes.length).toBe(32);
      const bytes2 = generateRandomBytes(32);
      expect(bytes).not.toEqual(bytes2); // Extremely unlikely to be equal
    });

    it("should generate random IDs of correct length", () => {
      const id = generateId(20);
      expect(id.length).toBe(20);
      const id2 = generateId(20);
      expect(id).not.toBe(id2);
    });
  });

  describe("Hashing (SHA256)", () => {
    it("should compute SHA256 correctly", () => {
      const data = new TextEncoder().encode("nanoauth");
      const hash = hashSHA256(data);
      // SHA256 of "nanoauth"
      expect(encodeHex(hash)).toBe("f6b4921d12a858dbd73f875026a7863219b183d3cd04e4e44c6da429d79d8bc0");
    });
  });

  describe("Equality (Timing Safe)", () => {
    it("should compare equal arrays correctly", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it("should compare different arrays correctly", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it("should return false for different lengths", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(timingSafeEqual(a, b)).toBe(false);
    });
  });

  describe("HMAC-SHA256", () => {
    it("should compute HMAC correctly", () => {
      const key = new TextEncoder().encode("key");
      const data = new TextEncoder().encode("data");
      const hmacResult = computeHMAC256(key, data);
      // HMAC-SHA256(key, data)
      expect(encodeHex(hmacResult)).toBe("5031fe3d989c6d1537a013fa6e739da23463fdaec3b70137d828e36ace221bd0");
    });
  });
});
