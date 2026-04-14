import { 
  encodeHexLowerCase as osloEncodeHex, 
  decodeHex as osloDecodeHex, 
  encodeBase64 as osloEncodeBase64, 
  decodeBase64 as osloDecodeBase64, 
  encodeBase64url as osloEncodeBase64url, 
  decodeBase64url as osloDecodeBase64url, 
  encodeBase32 as osloEncodeBase32, 
  decodeBase32 as osloDecodeBase32 
} from "@oslojs/encoding";

/**
 * Encode data to hex string
 */
export const encodeHex = (data: Uint8Array): string => osloEncodeHex(data);

/**
 * Decode hex string to Uint8Array
 */
export const decodeHex = (data: string): Uint8Array => osloDecodeHex(data);

/**
 * Encode data to base64 string
 */
export const encodeBase64 = (data: Uint8Array): string => osloEncodeBase64(data);

/**
 * Decode base64 string to Uint8Array
 */
export const decodeBase64 = (data: string): Uint8Array => osloDecodeBase64(data);

/**
 * Encode data to base64url string
 */
export const encodeBase64url = (data: Uint8Array): string => osloEncodeBase64url(data);

/**
 * Decode base64url string to Uint8Array
 */
export const decodeBase64url = (data: string): Uint8Array => osloDecodeBase64url(data);

/**
 * Encode data to base32 string
 */
export const encodeBase32 = (data: Uint8Array): string => osloEncodeBase32(data);

/**
 * Decode base32 string to Uint8Array
 */
export const decodeBase32 = (data: string): Uint8Array => osloDecodeBase32(data);
