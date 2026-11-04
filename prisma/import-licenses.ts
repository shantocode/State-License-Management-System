import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

/**
 * Imports existing licenses from data/License.xlsx (sheet "License").
 *
 * Columns: CID | Hunting | Mining | Weapon | Expiery Date
 * - Every "Yes" becomes one license of that type, with the row's expiry date.
 * - Citizen name is not in the sheet -> "N/A" (same for phone / ID picture).
 * - Safe to re-run: records already imported are skipped.
 *
 * Usage:
 *   npm run db:import-licenses -- --dry-run     (preview only, writes nothing)
 *   npm run db:import-licenses                  (real import)
 *   npm run db:import-licenses -- path/to/file.xlsx
 *
 * Also imports the "Driver" sheet (CID | Issue Date) as no-expiry driving licenses
 * (one license per unique CID; safe to re-run).
 */
const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const file =
  process.argv.slice(2).find((a) => a.toLowerCase().endsWith(".xlsx")) ??
  "data/License.xlsx";

// The sheet has no issue date. Issued date is shown as (expiry - this many days).
const ISSUED_DAYS_BEFORE_EXPIRY = 365;
const DAY = 86400000;

const TYPES = [
  { column: "hunting", code: "H", name: "Hunting License" },
  { column: "mining", code: "M", name: "Mining License" },
  { column: "weapon", code: "W", name: "Weapon License" },
] as const;

function toDate(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * DAY)); // Excel serial
  if (typeof v === "string" && v.trim() && !Number.isNaN(Date.parse(v)))
    return new Date(v);
  return null;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");
const isYes = (v: ExcelJS.CellValue) => String(v ?? "").trim().toLowerCase() === "yes";

async function importLicenses() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet("License");
  if (!ws) throw new Error('Sheet "License" not found.');

  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, n) => {
    const key = String(cell.value ?? "").trim().toLowerCase();
    col[key.startsWith("expi") ? "expiry" : key] = n;
  });
  for (const k of ["cid", "hunting", "mining", "weapon", "expiry"])
    if (!col[k]) throw new Error(`Column for "${k}" not found in header row.`);

  type Item = { cid: string; type: (typeof TYPES)[number]; expiresAt: Date };
  const items = new Map<string, Item>();
  const problems: string[] = [];
  let sheetRows = 0;
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cid = String(row.getCell(col.cid).value ?? "").trim();
    if (!cid) return;
    sheetRows++;
    const exp = toDate(row.getCell(col.expiry).value);
    if (!exp) return void problems.push(`Row ${n}: CID ${cid} has no valid expiry date.`);
    // valid through the whole expiry day (UTC)
    const expiresAt = new Date(Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate(), 23, 59, 59, 999));
    let any = false;
    for (const type of TYPES)
      if (isYes(row.getCell(col[type.column]).value)) {
        any = true;
        items.set(`${cid}|${type.code}|${ymd(expiresAt)}`, { cid, type, expiresAt });
      }
    if (!any) problems.push(`Row ${n}: CID ${cid} has no "Yes" license column.`);
  });

  const typeRows = await db.licenseType.findMany({
    where: { name: { in: TYPES.map((t) => t.name) } },
  });
  const typeId = new Map(typeRows.map((t) => [t.name, t.id]));
  for (const t of TYPES)
    if (!typeId.has(t.name))
      throw new Error(`License type "${t.name}" not found. Run "npm run db:seed" first.`);

  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const admin = await db.user.findUnique({ where: { username } });
  if (!admin) throw new Error(`Admin user "${username}" not found. Run "npm run db:seed" first.`);

  const existing = new Set(
    (await db.licenseApplication.findMany({
      where: { reference: { startsWith: "IMP-" } },
      select: { reference: true },
    })).map((a) => a.reference),
  );

  const now = new Date();
  // Imports ALL licenses from the sheet (active and expired).
  // Same CID + same type more than once = a renewal chain: older ones are saved
  // as renewed (EXPIRED + superseded) and linked to the next one, exactly like
  // a renewal made on the site.
  const source = [...items.values()];
  const todo = source
    .map((i) => ({ ...i, key: `${i.cid}-${i.type.code}-${ymd(i.expiresAt)}` }))
    .filter((i) => !existing.has(`IMP-${i.key}`));
  const expired = todo.filter((i) => i.expiresAt <= now).length;

  console.log(`Sheet rows: ${sheetRows} | licenses in sheet: ${items.size} | selected: ${source.length} | already imported: ${source.length - todo.length}`);
  console.log(`To import: ${todo.length} (${todo.length - expired} active, ${expired} already expired)`);
  problems.forEach((p) => console.warn("WARNING:", p));
  if (dryRun) return console.log("Dry run - nothing was written.");

  const chains = new Map<string, typeof todo>();
  for (const t of todo) {
    const k = `${t.cid}|${t.type.code}`;
    chains.set(k, [...(chains.get(k) ?? []), t]);
  }
  const groups = [...chains.values()].map((g) =>
    g.sort((x, y) => x.expiresAt.getTime() - y.expiresAt.getTime()),
  );

  let done = 0;
  for (let i = 0; i < groups.length; i += 20) {
    const batch = groups.slice(i, i + 20);
    await db.$transaction(
      async (tx) => {
        for (const chain of batch) {
          let prev: { id: string } | null = null;
          for (const t of chain) {
            const issuedAt = new Date(t.expiresAt.getTime() - ISSUED_DAYS_BEFORE_EXPIRY * DAY);
            const isExpired = t.expiresAt <= now;
            const app: { license: { id: string } | null } = await tx.licenseApplication.create({
              data: {
                reference: `IMP-${t.key}`,
                citizenName: "N/A",
                cid: t.cid,
                phone: "N/A",
                licenseTypeId: typeId.get(t.type.name)!,
                typeName: t.type.name,
                priceCents: 0,
                paymentCents: 0,
                citizenIdUrl: "N/A",
                requestedDays: 365,
                notes: "Imported from License.xlsx",
                lawyerId: admin.id,
                status: "APPROVED",
                paymentStatus: "WAIVED",
                durationDays: 365,
                createdAt: issuedAt,
                ...(prev ? { renewalOfId: prev.id } : {}),
                license: {
                  create: {
                    number: `LIC-IMP-${t.key}`,
                    citizenName: "N/A",
                    cid: t.cid,
                    issuedAt,
                    expiresAt: t.expiresAt,
                    status: isExpired ? "EXPIRED" : "ACTIVE",
                    // avoid a flood of "has expired" notifications from the cron job
                    expiredNotifiedAt: isExpired ? now : null,
                  },
                },
              },
              include: { license: true },
            });
            if (prev)
              await tx.license.update({
                where: { id: prev.id },
                data: { status: "EXPIRED", supersededAt: issuedAt, expiredNotifiedAt: now },
              });
            prev = app.license;
          }
        }
      },
      { timeout: 60000 },
    );
    done += batch.reduce((n, g) => n + g.length, 0);
    console.log(`Imported ${done}/${todo.length}`);
  }
  console.log("Done.");
}

async function importDrivers() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet("Driver");
  if (!ws) return console.log('No "Driver" sheet found - skipped.');

  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((c, n) => {
    const k = String(c.value ?? "").trim().toLowerCase();
    col[k.startsWith("issue") ? "issue" : k] = n;
  });
  if (!col.cid || !col.issue) throw new Error('Columns "CID" and "Issue Date" are required.');

  const dates = new Map<string, Date | null>();
  let rows = 0;
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cid = String(row.getCell(col.cid).value ?? "").trim();
    if (!cid) return;
    rows++;
    const d = toDate(row.getCell(col.issue).value);
    const cur = dates.get(cid);
    if (cur === undefined || (d && (!cur || d < cur))) dates.set(cid, d);
  });

  const type = await db.licenseType.findFirst({ where: { isDriving: true, deletedAt: null } });
  if (!type) throw new Error("Driving license type not found. Run the migrations first.");
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const admin = await db.user.findUnique({ where: { username } });
  if (!admin) throw new Error(`Admin user "${username}" not found.`);

  const existing = new Set(
    (await db.license.findMany({
      where: { deletedAt: null, status: "ACTIVE", application: { licenseType: { isDriving: true } } },
      select: { cid: true },
    })).map((l) => l.cid),
  );
  const refs = new Set(
    (await db.licenseApplication.findMany({
      where: { reference: { startsWith: "IMP-D-" } },
      select: { reference: true },
    })).map((a) => a.reference),
  );
  const todo = [...dates].filter(([cid]) => !existing.has(cid) && !refs.has(`IMP-D-${cid}`));
  const undated = todo.filter(([, d]) => !d).length;
  console.log(`[Driver] Sheet rows: ${rows} | unique CIDs: ${dates.size} | already in registry: ${dates.size - todo.length}`);
  console.log(`[Driver] To import: ${todo.length} (${undated} without an issue date -> today)`);
  if (dryRun) return console.log("Dry run - nothing was written.");

  const now = new Date();
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    await db.$transaction(
      async (tx) => {
        for (const [cid, d] of batch) {
          const issuedAt = d ?? now;
          await tx.licenseApplication.create({
            data: {
              reference: `IMP-D-${cid}`,
              citizenName: "N/A",
              cid,
              phone: "N/A",
              licenseTypeId: type.id,
              typeName: type.name,
              priceCents: 0,
              paymentCents: 0,
              citizenIdUrl: "",
              requestedDays: 0,
              durationDays: 0,
              notes: "Imported from License.xlsx (Driver sheet)",
              lawyerId: admin.id,
              reviewerId: admin.id,
              reviewedAt: issuedAt,
              status: "APPROVED",
              paymentStatus: "RECEIVED",
              createdAt: issuedAt,
              license: {
                create: { number: `LIC-IMP-D-${cid}`, citizenName: "N/A", cid, issuedAt, expiresAt: null },
              },
            },
          });
        }
      },
      { timeout: 60000 },
    );
    console.log(`Imported ${Math.min(i + 50, todo.length)}/${todo.length}`);
  }
  console.log("Done.");
}
async function main() {
  // Only the Driver sheet is imported. Hunting/Mining/Weapon are NOT touched.
  // To also run that old import, start with: npm run db:import-licenses -- --all
  if (process.argv.includes("--all")) await importLicenses();
  await importDrivers();
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());