export const redisTtl: number = process.env.REDIS_TTL
	? Number.parseInt(process.env.REDIS_TTL, 10)
	: 60 * 60 * 1; // 1 hour
