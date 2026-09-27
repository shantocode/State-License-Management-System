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
} from "../src/lib/policy";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { excelReport, pdfReport } from "../src/lib/export";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
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
  assert.equal(expiration(90, start).toISOString(), "2026-04-01T12:00:00.000Z");
  assert.equal(
    expiration(365, start).toISOString(),
    "2027-01-01T12:00:00.000Z",
  );
  assert.throws(() => expiration(31, start));
  assert.equal(effectiveStatus("ACTIVE", start, start), "EXPIRED");
  assert.equal(effectiveStatus("REVOKED", start, start), "REVOKED");
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
