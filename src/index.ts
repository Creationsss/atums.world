import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";
import { readdir } from "fs/promises";
import { resolve } from "path";

import { serverHandler } from "@/server";

import { redis } from "./helpers/redis";

async function initializeDatabase(): Promise<void> {
	const sqlDir: string = resolve("config", "sql");
	const files: string[] = await readdir(sqlDir);

	const reservation: ReservedSQL = await sql.reserve();
	for (const file of files) {
		if (file.endsWith(".ts")) {
			const { createTable } = await import(resolve(sqlDir, file));

			await createTable(reservation);
		}
	}

	reservation.release();
}

async function main(): Promise<void> {
	try {
		try {
			await sql`SELECT 1;`;

			logger.info([
				"Connected to PostgreSQL on",
				`${process.env.PGHOST}:${process.env.PGPORT}`,
			]);
		} catch (error) {
			logger.error([
				"Could not establish a connection to PostgreSQL:",
				error as Error,
			]);
			process.exit(1);
		}

		await redis.initialize();
		serverHandler.initialize();
		await initializeDatabase();
	} catch (error) {
		throw error;
	}
}

main().catch((error: Error) => {
	logger.error(["Error initializing the server:", error]);
	process.exit(1);
});
