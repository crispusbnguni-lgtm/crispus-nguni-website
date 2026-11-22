import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load local environment variables.
loadEnv({ path: ".env.local" });

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error("DIRECT_URL is not configured.");
}

const caCertificatePath = resolve(process.cwd(), "supabase-ca.crt");

if (!existsSync(caCertificatePath)) {
  throw new Error(`Supabase CA certificate not found: ${caCertificatePath}`);
}

// Prisma's CLI/schema engine reads the CA file from its connection URL.
// `sslcert` is the server CA parameter for Prisma's PostgreSQL connector;
// `sslaccept=strict` rejects missing or invalid certificate values.
const databaseUrl = new URL(directUrl);
databaseUrl.searchParams.set("sslmode", "require");
databaseUrl.searchParams.set("sslcert", caCertificatePath);
databaseUrl.searchParams.set("sslaccept", "strict");
databaseUrl.searchParams.delete("sslrootcert");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl.toString(),
  },
});
