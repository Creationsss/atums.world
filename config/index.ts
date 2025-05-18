import { resolve } from "node:path";
import { logger } from "@creations.works/logger";
import { normalizeFqdn } from "@lib/char";

const environment: Environment = {
	port: Number.parseInt(process.env.PORT || "8080", 10),
	host: process.env.HOST || "0.0.0.0",
	development:
		process.env.NODE_ENV === "development" || process.argv.includes("--dev"),
	fqdn: normalizeFqdn(process.env.FQDN) || "http://localhost:8080",
};

const dataType: { type: string; path: string | undefined } = {
	type: process.env.DATASOURCE_TYPE || "local",
	path:
		process.env.DATASOURCE_TYPE === "local"
			? resolve(process.env.DATASOURCE_LOCAL_DIRECTORY || "./uploads")
			: undefined,
};

function verifyRequiredVariables(): void {
	const requiredVariables = [
		"HOST",
		"PORT",

		"FQDN",

		"PGHOST",
		"PGPORT",
		"PGUSERNAME",
		"PGPASSWORD",
		"PGDATABASE",

		"REDIS_URL",
		"REDIS_TTL",

		"JWT_SECRET",
		"JWT_EXPIRES",

		"DATASOURCE_TYPE",
	];

	let hasError = false;

	for (const key of requiredVariables) {
		const value = process.env[key];
		if (value === undefined || value.trim() === "") {
			logger.error(`Missing or empty environment variable: ${key}`);
			hasError = true;
		}
	}

	if (hasError) {
		process.exit(1);
	}
}

export * from "@config/jwt";
export * from "@config/redis";

export { environment, dataType, verifyRequiredVariables };
