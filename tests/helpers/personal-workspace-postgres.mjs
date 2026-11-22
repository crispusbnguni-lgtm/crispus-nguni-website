import { isIP } from "node:net";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const integrationEnabled = process.env.RUN_PERSONAL_WORKSPACE_PG_INTEGRATION === "1";

export function validatePersonalWorkspaceTestUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    throw new Error("A dedicated Personal Workspace test database URL is required.");
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("The Personal Workspace test database URL is invalid.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("The Personal Workspace test database must use PostgreSQL.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(hostname);
  const loopback = hostname === "::1" || (ipVersion === 4 && hostname.split(".")[0] === "127");
  if (!loopback) {
    throw new Error("The Personal Workspace test database must use a loopback IP address.");
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("The Personal Workspace test database name is invalid.");
  }
  if (!/^crispus_workspace_test_[a-z0-9_]{1,48}$/i.test(databaseName)) {
    throw new Error("The database name is not an approved Personal Workspace test database.");
  }

  let username;
  try {
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error("The Personal Workspace test database role is invalid.");
  }
  if (!/^crispus_workspace_test_[a-z0-9_]{1,48}$/i.test(username)) {
    throw new Error("The database role is not an approved Personal Workspace test role.");
  }

  if (url.search || url.hash) {
    throw new Error("Connection options are not accepted for the Personal Workspace test database.");
  }

  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The Personal Workspace test database port is invalid.");
  }

  return { connectionString: url.toString(), databaseName, hostname, port };
}

let config = null;
let prisma = null;

if (integrationEnabled) {
  const rawUrl = process.env.PERSONAL_WORKSPACE_TEST_DATABASE_URL;
  config = validatePersonalWorkspaceTestUrl(rawUrl);
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.connectionString }) });
}

export { config, integrationEnabled, prisma };
