/**
 * E2E Encryption Service
 * Uses browser WebCrypto API — no third-party libraries.
 *
 * Key exchange: ECDH with P-256 curve
 * Message encryption: AES-GCM 256-bit (derived from ECDH shared secret via HKDF-SHA256)
 *
 * Private keys NEVER leave the browser — stored only in IndexedDB.
 * Public keys are uploaded to the server so contacts can encrypt messages for you.
 *
 * Usage flow:
 *   1. On first login: ensureKeyPair() — generates & stores key pair, uploads public key
 *   2. To send message: encryptMessage(recipientPublicKeyJwk, plaintext) → { ciphertext, iv }
 *   3. To receive message: decryptMessage(senderPublicKeyJwk, { ciphertext, iv }) → plaintext
 */

const DB_NAME = 'e2e_keys';
const STORE_NAME = 'keys';
const KEY_ID = 'ecdh_keypair';

/* ─── IndexedDB helpers ─────────────────────────────────────── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ─── Key generation & storage ─────────────────────────────── */

export interface StoredKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

/** Generate a new ECDH P-256 key pair and persist it to IndexedDB. */
export async function generateKeyPair(): Promise<StoredKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable so we can export to JWK
    ['deriveKey', 'deriveBits']
  );

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
  ]);

  const stored: StoredKeyPair = { publicKeyJwk, privateKeyJwk };
  await idbSet(KEY_ID, stored);
  return stored;
}

/** Load existing key pair from IndexedDB (or undefined if not generated yet). */
export async function loadKeyPair(): Promise<StoredKeyPair | undefined> {
  return idbGet<StoredKeyPair>(KEY_ID);
}

/** Get-or-create — returns existing key pair or generates a new one. */
export async function ensureKeyPair(): Promise<StoredKeyPair> {
  const existing = await loadKeyPair();
  if (existing) return existing;
  return generateKeyPair();
}

/* ─── ECDH shared secret derivation ────────────────────────── */

/**
 * Import a JWK public key for use in ECDH.
 */
async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

/**
 * Import a JWK private key for use in ECDH.
 */
async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derive a 256-bit AES-GCM key from the ECDH shared secret using HKDF.
 */
async function deriveAESKey(myPrivateJwk: JsonWebKey, theirPublicJwk: JsonWebKey): Promise<CryptoKey> {
  const [myPrivate, theirPublic] = await Promise.all([
    importPrivateKey(myPrivateJwk),
    importPublicKey(theirPublicJwk),
  ]);

  // Derive raw bits
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    256
  );

  // Import as base key for HKDF
  const baseKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  // Derive AES-GCM key
  const salt = new Uint8Array(32); // deterministic salt — both sides derive same key
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('professional-network-e2e'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ─── Encrypt / Decrypt ─────────────────────────────────────── */

export interface EncryptedMessage {
  ciphertext: string; // base64
  iv: string;         // base64 (12-byte random nonce)
  encrypted: true;
}

/**
 * Encrypt a plaintext message for a recipient.
 * @param recipientPublicKeyJwk  The recipient's ECDH public key from the server.
 * @param plaintext              The message to encrypt.
 * @returns Base64-encoded ciphertext + IV.
 */
export async function encryptMessage(
  recipientPublicKeyJwk: JsonWebKey,
  plaintext: string
): Promise<EncryptedMessage> {
  const myKeyPair = await ensureKeyPair();
  const aesKey = await deriveAESKey(myKeyPair.privateKeyJwk, recipientPublicKeyJwk);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
    encrypted: true,
  };
}

/**
 * Decrypt a message sent to us by a sender.
 * @param senderPublicKeyJwk  The sender's ECDH public key from the server.
 * @param msg                 The encrypted message object.
 * @returns Decrypted plaintext.
 */
export async function decryptMessage(
  senderPublicKeyJwk: JsonWebKey,
  msg: EncryptedMessage
): Promise<string> {
  const myKeyPair = await ensureKeyPair();
  const aesKey = await deriveAESKey(myKeyPair.privateKeyJwk, senderPublicKeyJwk);

  const ciphertextBytes = Uint8Array.from(atob(msg.ciphertext), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(msg.iv), (c) => c.charCodeAt(0));

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    ciphertextBytes
  );

  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Returns true if a message payload looks like an encrypted message.
 */
export function isEncrypted(content: unknown): content is EncryptedMessage {
  return (
    typeof content === 'object' &&
    content !== null &&
    'encrypted' in content &&
    (content as EncryptedMessage).encrypted === true &&
    'ciphertext' in content &&
    'iv' in content
  );
}

/**
 * Public key as a JSON string (for sending to the server).
 */
export async function getPublicKeyString(): Promise<string> {
  const kp = await ensureKeyPair();
  return JSON.stringify(kp.publicKeyJwk);
}
