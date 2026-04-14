import { describe, it, expect } from "bun:test";
import { createHS256JWT, verifyHS256JWT, decodeToken } from "./jwt";

describe("JWT Utils", () => {
  const secret = new TextEncoder().encode("super-secret-key-12345678901234567890");
  const payload = { userId: "user-123", role: "admin" };

  it("should create and verify a valid JWT", async () => {
    const jwt = await createHS256JWT(payload, secret);
    expect(jwt).toBeDefined();
    
    const verified = await verifyHS256JWT(jwt, secret);
    expect(verified.userId).toBe("user-123");
    expect(verified.role).toBe("admin");
    expect(verified.iat).toBeDefined();
  });

  it("should fail verification with wrong secret", async () => {
    const jwt = await createHS256JWT(payload, secret);
    const wrongSecret = new TextEncoder().encode("wrong-secret-key-1234567890");
    
    expect(verifyHS256JWT(jwt, wrongSecret)).rejects.toThrow("Invalid signature");
  });

  it("should fail verification for expired token", async () => {
    // Creating an already expired token
    const pastDate = new Date(Date.now() - 3600 * 1000); 
    const jwt = await createHS256JWT(payload, secret, { expiresAt: pastDate });
    
    expect(verifyHS256JWT(jwt, secret)).rejects.toThrow("Token expired");
  });

  it("should verify issuer and subject", async () => {
    const jwt = await createHS256JWT(payload, secret, { 
      issuer: "nanoauth", 
      subject: "auth-context" 
    });
    
    const verified = await verifyHS256JWT(jwt, secret);
    expect(verified.iss).toBe("nanoauth");
    expect(verified.sub).toBe("auth-context");
  });

  it("should decode token without verification", async () => {
    const jwt = await createHS256JWT(payload, secret);
    const decoded = decodeToken(jwt);
    expect((decoded as any).userId).toBe("user-123");
  });

  it("should throw on malformed JWT", async () => {
    expect(verifyHS256JWT("not.a.jwt", secret)).rejects.toThrow();
  });
});
