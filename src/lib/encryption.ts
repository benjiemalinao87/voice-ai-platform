// Frontend encryption utilities for API keys
// Uses Web Crypto API for AES-GCM encryption

/**
 * Derive an encryption key from a password and salt using PBKDF2
 */
async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt text using AES-GCM
 * @param text - Plain text to encrypt
 * @param password - User's password (used as encryption key)
 * @param salt - Unique salt for this user
 * @returns Base64-encoded encrypted data (IV + ciphertext)
 */
export async function encrypt(text: string, password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Derive encryption key
  const key = await deriveKey(password, salt);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt text using AES-GCM
 * @param encryptedText - Base64-encoded encrypted data
 * @param password - User's password (used as decryption key)
 * @param salt - Unique salt for this user
 * @returns Decrypted plain text
 */
export async function decrypt(encryptedText: string, password: string, salt: string): Promise<string> {
  const decoder = new TextDecoder();

  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Derive decryption key
  const key = await deriveKey(password, salt);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

/**
 * Generate a random salt for encryption
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

