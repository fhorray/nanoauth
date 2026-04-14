import { 
  encodeJWT, 
  decodeJWT, 
  createJWTSignatureMessage, 
  parseJWT, 
  joseAlgorithmHS256 
} from "@oslojs/jwt";
import { hmac } from "@oslojs/crypto/hmac";
import { SHA256 } from "@oslojs/crypto/sha2";
import { constantTimeEqual } from "@oslojs/crypto/subtle";

/**
 * Create a HMAC-SHA256 signed JWT
 */
export async function createHS256JWT(
  payload: object, 
  secret: Uint8Array, 
  options: { expiresAt?: Date; issuer?: string; subject?: string } = {}
): Promise<string> {
  const header = {
    alg: joseAlgorithmHS256,
    typ: "JWT"
  };

  const jwtPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    ...(options.expiresAt && { exp: Math.floor(options.expiresAt.getTime() / 1000) }),
    ...(options.issuer && { iss: options.issuer }),
    ...(options.subject && { sub: options.subject })
  };

  const headerJSON = JSON.stringify(header);
  const payloadJSON = JSON.stringify(jwtPayload);
  
  const signatureMessage = createJWTSignatureMessage(headerJSON, payloadJSON);
  const signature = hmac(SHA256, secret, signatureMessage);
  
  return encodeJWT(headerJSON, payloadJSON, signature);
}

/**
 * Verify a HMAC-SHA256 signed JWT
 */
export async function verifyHS256JWT(
  jwt: string, 
  secret: Uint8Array
): Promise<any> {
    const [header, payload, signature, signatureMessage] = parseJWT(jwt);
    
    // Check algorithm
    if ((header as any).alg !== joseAlgorithmHS256) {
      throw new Error("Invalid algorithm");
    }

    // Verify signature
    const expectedSignature = hmac(SHA256, secret, signatureMessage);
    if (!constantTimeEqual(signature, expectedSignature)) {
      throw new Error("Invalid signature");
    }

    // Verify expiration
    if ((payload as any).exp && (payload as any).exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    return payload;
}

/**
 * Purely decode a JWT without verification
 */
export function decodeToken(jwt: string): any {
  return decodeJWT(jwt);
}
