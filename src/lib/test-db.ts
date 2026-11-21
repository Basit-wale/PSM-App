
import { db } from "./db";

async function main() {
  try {
    const result = await db.$queryRaw`SELECT 1 AS connected`;
    console.log("Database connection successful:", result);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
