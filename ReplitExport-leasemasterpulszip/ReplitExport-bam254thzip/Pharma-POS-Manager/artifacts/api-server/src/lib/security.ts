import crypto from "node:crypto";

const key = crypto.createHash("sha256").update(process.env.MPESA_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "pharmaos-dev-encryption-key").digest();

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value: string): string {
  const [iv, tag, encrypted] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 3)}${"*".repeat(Math.max(5, value.length - 5))}${value.slice(-2)}`;
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return `254${digits}`;
}
