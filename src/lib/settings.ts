import "server-only";
import { cache } from "react";
import { db } from "./db";

export const systemSettings = cache(() =>
  db.systemSettings.findUnique({ where: { id: 1 } }),
);
