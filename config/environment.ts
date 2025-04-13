import { resolve } from "node:path";

export const environment: Environment = {
	port: Number.parseInt(process.env.PORT || "8080", 10),
	host: process.env.HOST || "0.0.0.0",
	development:
		process.env.NODE_ENV === "development" || process.argv.includes("--dev"),
};

export const redisConfig: {
	host: string;
	port: number;
	username?: string | undefined;
	password?: string | undefined;
} = {
	host: process.env.REDIS_HOST || "localhost",
	port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
	username: process.env.REDIS_USERNAME || undefined,
	password: process.env.REDIS_PASSWORD || undefined,
};

export const jwt: {
	secret: string;
	expiresIn: string;
} = {
	secret: process.env.JWT_SECRET || "",
	expiresIn: process.env.JWT_EXPIRES || "1d",
};

export const dataType: { type: string; path: string | undefined } = {
	type: process.env.DATASOURCE_TYPE || "local",
	path:
		process.env.DATASOURCE_TYPE === "local"
			? resolve(process.env.DATASOURCE_LOCAL_DIRECTORY || "./uploads")
			: undefined,
};
