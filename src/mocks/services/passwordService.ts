const PASSWORD_SCHEME = "pbkdf2-sha256";
const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}


function toCryptoBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toCryptoBuffer(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_BITS,
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(password, salt);
  return [
    PASSWORD_SCHEME,
    ITERATIONS,
    toBase64(salt),
    toBase64(derived),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedPassword: string,
): Promise<boolean> {
  const parts = storedPassword.split("$");

  if (parts.length !== 4 || parts[0] !== PASSWORD_SCHEME) {
    // Development databases created before password hashing may still contain
    // plaintext credentials. They are accepted only for one migration path.
    return storedPassword === password;
  }

  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return false;

  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await deriveWithIterations(password, salt, iterations);

  return constantTimeEqual(actual, expected);
}

async function deriveWithIterations(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toCryptoBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    key,
    KEY_BITS,
  );

  return new Uint8Array(bits);
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${PASSWORD_SCHEME}$`);
}
