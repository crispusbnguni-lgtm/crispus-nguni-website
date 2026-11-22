
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load local environment variables when available.
// Railway supplies its own environment variables.
loadEnv({ path: ".env.local" });

const directUrl = process.env.DIRECT_URL;

let datasource: { url: string } | undefined;

if (directUrl) {
  const caCertificatePath = resolve(
    process.cwd(),
    "prisma",
    "supabase-ca.crt"
  );

  if (!existsSync(caCertificatePath)) {
    throw new Error(
      `Supabase CA certificate not found: ${caCertificatePath}`
    );
  }

  const databaseUrl = new URL(directUrl);

  databaseUrl.searchParams.set("sslmode", "require");
  databaseUrl.searchParams.set("sslcert", caCertificatePath);
  databaseUrl.searchParams.set("sslaccept", "strict");
  databaseUrl.searchParams.delete("sslrootcert");

  datasource = {
    url: databaseUrl.toString(),
  };
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(datasource ? { datasource } : {}),
});
