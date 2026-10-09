import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distribute,
  expiration,
  effectiveStatus,
  canReview,
  canReadApplication,
  cents,
  roles,
  durations,
  durationLabel,
  priceForDays,
} from "../src/lib/policy";
import { citizenSchema, requestedDays, requestedDaysByType } from "../src/lib/validation";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { excelReport, pdfReport } from "../src/lib/export";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { Prisma } from "@prisma/client";
test("two-month pricing reads the established database column", () => {
  const type = Prisma.dmmf.datamodel.models.find((model) => model.name === "LicenseType");
  const price = type?.fields.find((field) => field.name === "price60Cents");
  assert.equal(price?.dbName, "price90Cents");
  assert.equal(price?.type, "Int");
});
test("revenue conserves cents and rejects invalid percentages", () => {
  assert.deepEqual(distribute(5000000, 5000, 3000, 2000), {
    lawyerCents: 2500000,
    reviewerCents: 1500000,
    governmentCents: 1000000,
  });
  for (const total of [1, 3, 99, 10001, 5000000]) {
    const s = distribute(total, 3333, 3333, 3334);
    assert.equal(s.lawyerCents + s.reviewerCents + s.governmentCents, total);
  }
  assert.throws(() => distribute(10, 5000, 3000, 3000));
  assert.throws(() => distribute(10, -1, 5001, 5000));
  assert.throws(() => cents("-1"));
  assert.equal(cents("50000.01"), 5000001);
  assert.throws(() => cents("1.001"));
});
test("role and ownership boundaries", () => {
  assert.equal(canReview("LAWYER"), false);
  for (const role of roles.filter((r) => r !== "LAWYER"))
    assert.equal(canReview(role), true);
  assert.equal(canReadApplication("LAWYER", "one", "two"), false);
  assert.equal(canReadApplication("LAWYER", "one", "one"), true);
});
test("fixed-day durations and expiry boundary", () => {
  const start = new Date("2026-01-01T12:00:00Z");
  assert.equal(expiration(60, start).toISOString(), "2026-03-02T12:00:00.000Z");
  assert.equal(
    expiration(365, start).toISOString(),
    "2027-01-01T12:00:00.000Z",
  );
  assert.throws(() => expiration(31, start));
  assert.throws(() => expiration(90, start));
  assert.equal(effectiveStatus("ACTIVE", start, start), "EXPIRED");
  assert.equal(effectiveStatus("REVOKED", start, start), "REVOKED");
});
test("two-month applications use the short-term price and need no ID picture link", () => {
  assert.deepEqual(durations, [60, 180, 365]);
  assert.equal(durationLabel(60), "2 months");
  assert.equal(durationLabel(90), "3 months");
  const type = { price60Cents: 10000, price180Cents: 20000, price365Cents: 30000 };
  assert.equal(priceForDays(type, 60), 10000);
  assert.equal(priceForDays(type, 180), 20000);
  assert.equal(priceForDays(type, 365), 30000);
  assert.throws(() => priceForDays(type, 90));
  const citizen = { citizenName: "Test Citizen", cid: "CID-1", phone: "12345", notes: "" };
  assert.deepEqual(citizenSchema.parse(citizen), citizen);
  assert.equal(citizenSchema.safeParse({ ...citizen, cid: "" }).success, false);
  const form = new FormData();
  form.set("days", "60");
  form.set("days_type-1", "60");
  assert.equal(requestedDays(form), 60);
  assert.equal(requestedDaysByType(form, ["type-1"]).get("type-1"), 60);
  form.set("days", "90");
  form.set("days_type-1", "90");
  assert.throws(() => requestedDays(form));
  assert.throws(() => requestedDaysByType(form, ["type-1"]));
});
test("passwords are salted and verified", async () => {
  const password = "A long unique test password";
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong", a), false);
});
test("Excel output keeps text as text and PDF supports Bengali names", async () => {
  const report = {
    title: "Test report",
    headers: ["Citizen", "Amount ($)"],
    rows: [
      ['=HYPERLINK("bad")', 500],
      ["রহিম উদ্দিন", 1000],
    ],
  };
  const xlsx = await excelReport(report),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(xlsx.buffer as ArrayBuffer);
  assert.equal(book.worksheets[0].getCell("A2").value, '=HYPERLINK("bad")');
  assert.equal(book.worksheets[0].getCell("B3").value, 1000);
  const pdf = await pdfReport(report);
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
});
