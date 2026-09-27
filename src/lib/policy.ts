export const roles = [
  "ADMIN",
  "LAWYER",
  "STATE_EMPLOYEE",
  "STATE_ASSISTANT",
  "REVIEWER",
] as const;
export type RoleCode = (typeof roles)[number];
export const reviewers: RoleCode[] = [
  "ADMIN",
  "STATE_EMPLOYEE",
  "STATE_ASSISTANT",
  "REVIEWER",
];
export const durations = [90, 180, 365] as const;
export function priceForDays(
  type: { price90Cents: number; price180Cents: number; price365Cents: number },
  days: number,
) {
  const price = (
    { 90: type.price90Cents, 180: type.price180Cents, 365: type.price365Cents } as Record<
      number,
      number
    >
  )[days];
  if (price === undefined)
    throw new Error("Select a valid license duration.");
  return price;
}
export const durationLabel = (days: number) =>
  ({ 90: "3 months", 180: "6 months", 365: "12 months" })[days] ??
  `${days} days`;
export const paymentStatuses = ["RECEIVED", "NOT_RECEIVED", "WAIVED"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];
export const paymentStatusLabel = (status: string) =>
  ({
    RECEIVED: "Payment received",
    NOT_RECEIVED: "Payment not received",
    WAIVED: "Payment waived",
  })[status] ?? status;
export const roleLabel = (role: string) =>
  ({
    ADMIN: "Administrator",
    LAWYER: "Lawyer",
    STATE_EMPLOYEE: "State employee",
    STATE_ASSISTANT: "State assistant",
    REVIEWER: "Authorized reviewer",
  })[role] ?? role;
export function canReview(role: RoleCode) {
  return reviewers.includes(role);
}
export function canReadApplication(
  role: RoleCode,
  userId: string,
  lawyerId: string,
) {
  return role !== "LAWYER" || userId === lawyerId;
}
export function distribute(
  total: number,
  lawyerBps: number,
  reviewerBps: number,
  governmentBps: number,
) {
  if (
    ![total, lawyerBps, reviewerBps, governmentBps].every(
      Number.isSafeInteger,
    ) ||
    total < 0 ||
    [lawyerBps, reviewerBps, governmentBps].some((x) => x < 0) ||
    lawyerBps + reviewerBps + governmentBps !== 10000
  )
    throw new Error("Revenue percentages must total 100%.");
  const lawyerCents = Math.floor((total * lawyerBps) / 10000);
  const reviewerCents = Math.floor((total * reviewerBps) / 10000);
  return {
    lawyerCents,
    reviewerCents,
    governmentCents: total - lawyerCents - reviewerCents,
  };
}
export function expiration(days: number, start: Date) {
  if (!(durations as readonly number[]).includes(days))
    throw new Error("Select a valid license duration.");
  return new Date(start.getTime() + days * 86400000);
}
export function effectiveStatus(
  status: string,
  expiresAt: Date,
  now = new Date(),
) {
  return status === "ACTIVE" && expiresAt <= now ? "EXPIRED" : status;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const date = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export function cents(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
    throw new Error("Enter a valid amount with at most two decimal places.");
  const amount = Math.round(Number(text) * 100);
  if (amount > 1000000000) throw new Error("Amount is too large.");
  return amount;
}
