import { describe, it, expect } from "bun:test";
import { 
  encodeHex, decodeHex, 
  encodeBase64, decodeBase64, 
  encodeBase64url, decodeBase64url,
  encodeBase32, decodeBase32 
} from "./encoding";

describe("Encoding Utils", () => {
  const testData = new TextEncoder().encode("Hello, NanoAuth! 🚀 12345");

  describe("Hex", () => {
    it("should encode and decode hex correctly", () => {
      const encoded = encodeHex(testData);
      const decoded = decodeHex(encoded);
      expect(decoded).toEqual(testData);
      expect(encoded).toBe("48656c6c6f2c204e616e6f417574682120f09f9a80203132333435");
    });

    it("should handle empty data", () => {
      const data = new Uint8Array(0);
      expect(encodeHex(data)).toBe("");
      expect(decodeHex("")).toEqual(data);
    });
  });

  describe("Base64", () => {
    it("should encode and decode base64 correctly", () => {
      const encoded = encodeBase64(testData);
      const decoded = decodeBase64(encoded);
      expect(decoded).toEqual(testData);
    });

    it("should handle empty data", () => {
      const data = new Uint8Array(0);
      expect(encodeBase64(data)).toBe("");
      expect(decodeBase64("")).toEqual(data);
    });
  });

  describe("Base64url", () => {
    it("should encode and decode base64url correctly", () => {
      const encoded = encodeBase64url(testData);
      const decoded = decodeBase64url(encoded);
      expect(decoded).toEqual(testData);
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
    });
  });

  describe("Base32", () => {
    it("should encode and decode base32 correctly", () => {
      const encoded = encodeBase32(testData);
      const decoded = decodeBase32(encoded);
      expect(decoded).toEqual(testData);
    });

    it("should handle empty data", () => {
      const data = new Uint8Array(0);
      expect(encodeBase32(data)).toBe("");
      expect(decodeBase32("")).toEqual(data);
    });
  });
});
