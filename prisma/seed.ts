import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { roles } from "../src/lib/policy";
const db = new PrismaClient();
async function seed() {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const existing = await db.user.findUnique({ where: { username } });
  if (
    !existing &&
    (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8)
  )
    throw new Error(
      "Set ADMIN_PASSWORD to a unique password of at least 8 characters before seeding.",
    );
  for (const code of roles)
    await db.role.upsert({ where: { code }, create: { code }, update: {} });
  const role = await db.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  if (!existing)
    await db.user.create({
      data: {
        username,
        name: process.env.ADMIN_NAME || "System Administrator",
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD!),
        roleId: role.id,
        mustChangePassword: true,
      },
    });
  await db.systemSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  for (const [
    name,
    price90Cents,
    price180Cents,
    price365Cents,
    description,
  ] of [
    [
      "Weapon License",
      3000000,
      5000000,
      9000000,
      "Authorization to possess a registered weapon.",
    ],
    [
      "Hunting License",
      1500000,
      2500000,
      4500000,
      "Authorization for regulated hunting activities.",
    ],
    [
      "Mining License",
      900000,
      1500000,
      2700000,
      "Authorization for regulated mineral extraction.",
    ],
  ] as const)
    await db.licenseType.upsert({
      where: { name },
      create: { name, price90Cents, price180Cents, price365Cents, description },
      update: {},
    });
  console.log(
    "Roles, default license types, settings, and initial administrator are ready. Existing data was preserved.",
  );
}
seed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
