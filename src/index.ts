import { existsSync, mkdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { dataType } from "@config/environment";
import { logger } from "@helpers/logger";
import { type ReservedSQL, s3, sql } from "bun";

import { serverHandler } from "@/server";

import { redis } from "./helpers/redis";

async function initializeDatabase(): Promise<void> {
	const sqlDir: string = resolve("config", "sql");
	const files: string[] = await readdir(sqlDir);

	const modules: Module[] = await Promise.all(
		files
			.filter((file: string): boolean => file.endsWith(".ts"))
			.map(async (file: string): Promise<Module> => {
				const module: Module["module"] = await import(resolve(sqlDir, file));
				return { file, module };
			}),
	);

	modules.sort(
		(a: Module, b: Module): number =>
			(a.module.order ?? 0) - (b.module.order ?? 0),
	);

	const reservation: ReservedSQL = await sql.reserve();
	for (const { module } of modules) {
		if (module.createTable) {
			await module.createTable(reservation);
		}
	}

	reservation.release();
}

async function main(): Promise<void> {
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

	if (dataType.type === "local" && dataType.path) {
		if (!existsSync(dataType.path)) {
			try {
				mkdirSync(dataType.path);
			} catch (error) {
				logger.error([
					"Could not create datasource local directory",
					error as Error,
				]);
				process.exit(1);
			}
		}

		logger.info(["Using local datasource directory", `${dataType.path}`]);
	} else {
		try {
			await s3.write("test", "test");
			await s3.delete("test");

			logger.info(["Connected to S3 with bucket", `${process.env.S3_BUCKET}`]);
		} catch (error) {
			logger.error([
				"Could not establish a connection to S3 bucket:",
				error as Error,
			]);
			process.exit(1);
		}
	}

	await redis.initialize();
	serverHandler.initialize();
	await initializeDatabase();
}

main().catch((error: Error) => {
	logger.error(["Error initializing the server:", error]);
	process.exit(1);
});
