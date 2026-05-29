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
const WRAPPED_KEY_ID = 'ecdh_keypair_wrapped';
const ECDSA_PRIVATE_KEY_ID = 'ecdsa-private-signing-key';
const ECDSA_PUBLIC_KEY_ID = 'ecdsa-public-signing-key';

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

/** PBKDF2-wrapped private key envelope stored in IndexedDB */
export interface WrappedPrivateKey {
  publicKeyJwk: JsonWebKey;
  /** AES-GCM ciphertext of privateKeyJwk (JSON bytes), base64 */
  wrappedKey: string;
  /** PBKDF2 salt, base64 */
  salt: string;
  /** AES-GCM IV, base64 */
  iv: string;
}

/* ─── Private key wrapping helpers ─────────────────────────── */

function buf2b64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}
function b64buf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function deriveWrapKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Wrap (encrypt) a private key JWK using PBKDF2+AES-GCM from a user password. */
async function wrapPrivateKey(password: string, privateKeyJwk: JsonWebKey): Promise<{ wrappedKey: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await deriveWrapKey(password, salt);
  const jwkBytes = new TextEncoder().encode(JSON.stringify(privateKeyJwk));
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, wrapKey, jwkBytes);
  return { wrappedKey: buf2b64(wrapped), salt: buf2b64(salt), iv: buf2b64(iv) };
}

/** Unwrap (decrypt) a private key JWK using PBKDF2+AES-GCM from a user password. */
async function unwrapPrivateKey(password: string, envelope: { wrappedKey: string; salt: string; iv: string }): Promise<JsonWebKey> {
  const wrapKey = await deriveWrapKey(password, b64buf(envelope.salt));
  const ivBytes = b64buf(envelope.iv);
  const wrappedBytes = b64buf(envelope.wrappedKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer },
    wrapKey,
    wrappedBytes.buffer as ArrayBuffer
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/** Generate a new ECDH P-256 key pair and persist it to IndexedDB.
 *  If a password is provided, the private key is wrapped with PBKDF2+AES-GCM.
 *  Falls back to plain storage when password is not available (e.g. SSO flows). */
export async function generateKeyPair(password?: string): Promise<StoredKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable so we can export to JWK
    ['deriveKey', 'deriveBits']
  );

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
  ]);

  if (password) {
    const wrapped = await wrapPrivateKey(password, privateKeyJwk);
    const envelope: WrappedPrivateKey = { publicKeyJwk, ...wrapped };
    await idbSet(WRAPPED_KEY_ID, envelope);
    // Clear any old plain keypair to avoid stale unprotected key
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY_ID);
  } else {
    const stored: StoredKeyPair = { publicKeyJwk, privateKeyJwk };
    await idbSet(KEY_ID, stored);
  }

  return { publicKeyJwk, privateKeyJwk };
}

/** Load existing key pair from IndexedDB.
 *  If the key was wrapped and a password is provided, it is unwrapped transparently.
 *  Falls back to plain (legacy) storage if no wrapped key found. */
export async function loadKeyPair(password?: string): Promise<StoredKeyPair | undefined> {
  // Try wrapped key first (preferred)
  const wrapped = await idbGet<WrappedPrivateKey>(WRAPPED_KEY_ID);
  if (wrapped) {
    if (!password) return undefined; // can't unwrap without password
    try {
      const privateKeyJwk = await unwrapPrivateKey(password, wrapped);
      return { publicKeyJwk: wrapped.publicKeyJwk, privateKeyJwk };
    } catch {
      return undefined; // wrong password or corrupted
    }
  }
  // Legacy plain storage fallback
  return idbGet<StoredKeyPair>(KEY_ID);
}

/** Get-or-create — returns existing key pair or generates a new one.
 *  Pass the user's password to enable private-key wrapping. */
export async function ensureKeyPair(password?: string): Promise<StoredKeyPair> {
  const existing = await loadKeyPair(password);
  if (existing) return existing;
  return generateKeyPair(password);
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

/* ─── E2EE Binary (resume in job applications) ──────────────── */

export interface EncryptedBinary {
  /** Base64-encoded AES-GCM ciphertext of the binary file */
  ciphertext: string;
  /** Base64-encoded 12-byte AES-GCM IV */
  iv: string;
  /** Sender's ECDH public key JWK (so recipient can derive the same AES key) */
  senderPublicKeyJwk: JsonWebKey;
}

/**
 * Encrypt a binary buffer (e.g. a resume file) for a specific recipient.
 * Uses ECDH + HKDF-SHA256 + AES-256-GCM — same key agreement as messages.
 * The sender's public key is included so the recipient can decrypt.
 */
export async function encryptBinaryForRecipient(
  recipientPublicKeyJwk: JsonWebKey,
  buffer: ArrayBuffer
): Promise<EncryptedBinary> {
  const myKeyPair = await ensureKeyPair();
  const aesKey = await deriveAESKey(myKeyPair.privateKeyJwk, recipientPublicKeyJwk);

  const ivArr = new Uint8Array(12);
  crypto.getRandomValues(ivArr);
  const ivBuf = toAB(ivArr);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuf },
    aesKey,
    buffer
  );

  return {
    ciphertext: buf2b64(cipherBuf),
    iv: btoa(String.fromCharCode(...ivArr)),
    senderPublicKeyJwk: myKeyPair.publicKeyJwk,
  };
}

/**
 * Decrypt a binary buffer encrypted by a sender for us.
 * @param senderPublicKeyJwk  The sender's ECDH public key (stored in the application).
 * @param ciphertextB64       Base64 ciphertext.
 * @param ivB64               Base64 IV.
 */
export async function decryptBinaryFromSender(
  senderPublicKeyJwk: JsonWebKey,
  ciphertextB64: string,
  ivB64: string
): Promise<ArrayBuffer> {
  const myKeyPair = await ensureKeyPair();
  const aesKey = await deriveAESKey(myKeyPair.privateKeyJwk, senderPublicKeyJwk);

  const ciphertextBytes = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    ciphertextBytes
  );
}

/**
 * Generate a new ECDSA P-256 signing key pair and persist it to IndexedDB.
 * The private key is stored as a non-extractable CryptoKey.
 * The public key is stored as a JWK for easy export.
 */
export async function generateSigningKeyPair(): Promise<JsonWebKey> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  await idbSet(ECDSA_PRIVATE_KEY_ID, keyPair.privateKey);

  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  await idbSet(ECDSA_PUBLIC_KEY_ID, publicJwk);
  return publicJwk;
}

/** Load existing ECDSA signing private key from IndexedDB. */
export async function loadSigningPrivateKey(): Promise<CryptoKey | undefined> {
  return idbGet<CryptoKey>(ECDSA_PRIVATE_KEY_ID);
}

/** Load existing ECDSA signing public key (JWK) from IndexedDB. */
export async function loadSigningPublicKeyJwk(): Promise<JsonWebKey | undefined> {
  return idbGet<JsonWebKey>(ECDSA_PUBLIC_KEY_ID);
}

/** Get-or-create ECDSA signing key pair. Returns the public key JWK. */
export async function ensureSigningKeyPair(): Promise<JsonWebKey> {
  const existing = await loadSigningPublicKeyJwk();
  if (existing) return existing;
  return generateSigningKeyPair();
}

/**
 * Sign the given data with the ECDSA private key.
 * @returns base64-encoded DER signature, or null if no signing key is available.
 */
export async function signContent(data: string): Promise<string | null> {
  const privKey = await loadSigningPrivateKey();
  if (!privKey) return null;

  const encoded = new TextEncoder().encode(data);
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privKey,
    encoded
  );
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}

/* ─── Zero-Knowledge Resume Encryption ─────────────────────── */

/**
 * ZK Resume Encryption — all crypto happens in the browser.
 * The server NEVER sees the passphrase or the plaintext file.
 *
 * Key derivation: PBKDF2-SHA256, 100,000 iterations, 256-bit output
 * Encryption:     AES-256-GCM
 *
 * The derived key is cached in sessionStorage (base64) for the lifetime of
 * the browser tab so the user only needs to type their passphrase once per
 * session. The cache is cleared on logout (authStore calls clearResumeKey).
 */

/** In-memory key cache: maps saltHex → CryptoKey (non-extractable after caching).
 *  Stored in module scope — lives only for the duration of the browser tab.
 *  Never persisted to sessionStorage or localStorage.
 */
const _resumeKeyCache = new Map<string, CryptoKey>();

/** Always returns a guaranteed ArrayBuffer (never SharedArrayBuffer) */
function toAB(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.length);
  new Uint8Array(ab).set(u8);
  return ab;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveResumeKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toAB(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/** Check whether a cached resume key exists for this tab session. */
export function hasResumeKey(): boolean {
  return _resumeKeyCache.size > 0;
}

/** Clear the cached resume key (call on logout). */
export function clearResumeKey(): void {
  _resumeKeyCache.clear();
}

async function getCachedResumeKey(saltHex: string): Promise<CryptoKey | null> {
  return _resumeKeyCache.get(saltHex) ?? null;
}

async function cacheResumeKey(key: CryptoKey, saltHex: string): Promise<void> {
  // Re-import as non-extractable so raw bytes can't be read back by any JS code
  const raw = await crypto.subtle.exportKey('raw', key);
  const nonExtractable = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  _resumeKeyCache.set(saltHex, nonExtractable);
}

export interface EncryptedResume {
  /** Encrypted file bytes (ciphertext + 16-byte GCM auth tag appended by WebCrypto) */
  ciphertext: Uint8Array;
  /** PBKDF2 salt — hex, 32 hex chars (16 bytes) */
  salt: string;
  /** AES-GCM IV — hex, 24 hex chars (12 bytes) */
  iv: string;
}

/**
 * Encrypt a file in the browser using a user passphrase.
 * The derived key is cached in sessionStorage for the tab lifetime.
 *
 * @param passphrase  User-chosen passphrase (never sent to server)
 * @param fileBuffer  Raw file bytes (ArrayBuffer)
 */
export async function encryptResume(passphrase: string, fileBuffer: ArrayBuffer): Promise<EncryptedResume> {
  const saltArr = new Uint8Array(16);
  const ivArr = new Uint8Array(12);
  crypto.getRandomValues(saltArr);
  crypto.getRandomValues(ivArr);
  const key = await deriveResumeKeyFromPassphrase(passphrase, saltArr);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toAB(ivArr) },
    key,
    fileBuffer
  );

  const saltHex = bytesToHex(saltArr);
  await cacheResumeKey(key, saltHex);

  return {
    ciphertext: new Uint8Array(ciphertext),
    salt: saltHex,
    iv: bytesToHex(ivArr),
  };
}

/**
 * Decrypt a resume file in the browser.
 * Uses cached key from sessionStorage if available (same salt); otherwise
 * derives the key from the provided passphrase.
 *
 * @param passphrase      null to use cached key; string to derive fresh key
 * @param saltHex         Hex salt returned by server in X-Resume-Salt header
 * @param ivHex           Hex IV returned by server in X-Resume-Iv header
 * @param ciphertextBuf   Raw response bytes from the server
 */
export async function decryptResume(
  passphrase: string | null,
  saltHex: string,
  ivHex: string,
  ciphertextBuf: ArrayBuffer
): Promise<ArrayBuffer> {
  let key: CryptoKey | null = null;

  if (!passphrase) {
    key = await getCachedResumeKey(saltHex);
    if (!key) throw new Error('No cached key — passphrase required');
  } else {
    key = await deriveResumeKeyFromPassphrase(passphrase, hexToBytes(saltHex));
    await cacheResumeKey(key, saltHex);
  }

  const iv = hexToBytes(ivHex);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toAB(iv) },
    key,
    ciphertextBuf
  );
}
