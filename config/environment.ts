export const environment: Environment = {
	port: parseInt(process.env.PORT || "8080", 10),
	host: process.env.HOST || "0.0.0.0",
	development:
		process.env.NODE_ENV === "development" ||
		process.argv.includes("--dev"),
};

export const redisConfig: {
	host: string;
	port: number;
	username?: string | undefined;
	password?: string | undefined;
} = {
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT || "6379", 10),
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
