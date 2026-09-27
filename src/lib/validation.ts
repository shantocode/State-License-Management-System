import { z } from "zod";
import { roles, durations } from "./policy";
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128);
export const userSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,60}$/,
      "Username: 3–60 letters, digits, dots, dashes or underscores.",
    ),
  name: z.string().trim().min(2).max(120),
  role: z.enum(roles),
});
export const citizenSchema = z.object({
  citizenName: z.string().trim().min(2).max(120),
  cid: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(
      /^[\w-]+$/,
      "CID must contain letters, numbers, underscores or dashes.",
    ),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\d\s-]{5,30}$/, "Enter a valid phone number."),
  citizenIdUrl: z
    .string()
    .trim()
    .max(500)
    .url("Enter a valid link (https://…) to the Citizen ID picture."),
  notes: z.string().trim().max(5000),
});
export const object = (form: FormData) => Object.fromEntries(form.entries());
export function licenseTypeIds(form: FormData) {
  const ids = [...new Set(form.getAll("licenseTypeIds").map(String))].filter(
    Boolean,
  );
  if (!ids.length) throw new Error("Select at least one license type.");
  if (ids.length > 20) throw new Error("Select at most 20 license types.");
  return ids;
}
export function requestedDays(form: FormData) {
  const days = Number(form.get("days"));
  if (!(durations as readonly number[]).includes(days))
    throw new Error("Select a valid license duration.");
  return days;
}
// Each selected license type gets its own duration, via a `days_<typeId>` field.
export function requestedDaysByType(form: FormData, typeIds: string[]) {
  const map = new Map<string, number>();
  for (const id of typeIds) {
    const days = Number(form.get(`days_${id}`));
    if (!(durations as readonly number[]).includes(days))
      throw new Error("Select a valid license duration for every type chosen.");
    map.set(id, days);
  }
  return map;
}
