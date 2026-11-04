import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, expected] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === hash.length && timingSafeEqual(buffer, hash);
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
