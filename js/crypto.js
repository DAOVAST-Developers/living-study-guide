/**
 * Web Crypto API Module (PBKDF2 + AES-GCM)
 * Encrypts/decrypts application state locally in the user's browser.
 * Zero-server, zero-leak.
 */

const PBKDF2_ITERATIONS = 120000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12; // Standard for AES-GCM

function getSubtleCrypto() {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (subtle) is not available in this environment.');
}

function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Secure random byte generator unavailable.');
  }
  return bytes;
}

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM 256-bit key from a passphrase and salt using PBKDF2 (SHA-256)
 */
export async function deriveKey(passphrase, saltBuffer) {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const passwordKey = await subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using a passphrase.
 * Returns an envelope object: { v: 1, salt: base64, iv: base64, data: base64 }
 */
export async function encryptData(plainText, passphrase) {
  if (typeof plainText !== 'string') {
    throw new TypeError('encryptData expects a string input');
  }
  if (!passphrase) {
    throw new Error('Passphrase cannot be empty');
  }

  const subtle = getSubtleCrypto();
  const salt = getRandomBytes(SALT_BYTE_LENGTH);
  const iv = getRandomBytes(IV_BYTE_LENGTH);
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );

  return {
    v: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(cipherBuffer)
  };
}

/**
 * Decrypts an envelope object using the given passphrase.
 * Throws an error if the passphrase is wrong or the ciphertext has been tampered with.
 */
export async function decryptData(envelope, passphrase) {
  if (!envelope || !envelope.salt || !envelope.iv || !envelope.data) {
    throw new Error('Invalid encryption envelope');
  }
  if (!passphrase) {
    throw new Error('Passphrase cannot be empty');
  }

  const subtle = getSubtleCrypto();
  const saltBuffer = base64ToBuffer(envelope.salt);
  const ivBuffer = base64ToBuffer(envelope.iv);
  const dataBuffer = base64ToBuffer(envelope.data);

  const key = await deriveKey(passphrase, saltBuffer);

  try {
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      key,
      dataBuffer
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error('Decryption failed. Incorrect passphrase or corrupted data.');
  }
}
