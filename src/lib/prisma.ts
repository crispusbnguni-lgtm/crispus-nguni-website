import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

// Keep TLS settings out of the URL: node-postgres replaces its explicit `ssl`
// object when SSL-related URL parameters are present.
const connectionUrl = new URL(connectionString);
for (const key of [
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslidentity",
  "sslpassword",
  "sslaccept",
]) {
  connectionUrl.searchParams.delete(key);
}

const caCertificate = readFileSync(
  resolve(process.cwd(), "supabase-ca.crt"),
  "utf8"
);

const adapter = new PrismaPg({
  connectionString: connectionUrl.toString(),
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true,
  },
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
