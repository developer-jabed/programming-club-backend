import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import config from "../config/index.js";

const pool = new Pool({
  connectionString: config.database_url,
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 20_000,
  query_timeout: 20_000,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
  transactionOptions: {
    timeout: 20_000,
    maxWait: 10_000,
  },
});