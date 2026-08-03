import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Device credentials (MQTT passwords, Home Assistant tokens, shared secrets)
 * are stored as AES-256-GCM ciphertext and only ever decrypted inside a
 * server function. They are never written to a plaintext column.
 */

function key(): Buffer {
  const raw = process.env["DEVICE_CREDENTIAL_SECRET"];
  if (!raw) throw new Error("DEVICE_CREDENTIAL_SECRET is not configured");
  return scryptSync(raw, "nexora-device-credentials", 32);
}

export function encryptCredentials(value: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptCredentials(stored: string): Record<string, unknown> {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as Record<string, unknown>;
}
