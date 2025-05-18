import { environment, jwt } from "@config";
import { redis } from "bun";
import { createDecoder, createSigner, createVerifier } from "fast-jwt";

const signer = createSigner({ key: jwt.secret, expiresIn: jwt.expiration });
const verifier = createVerifier({ key: jwt.secret });
const decoder = createDecoder();

export async function createSession(
	payload: UserSession,
	userAgent: string,
): Promise<string> {
	const token = signer(payload);
	const sessionKey = `session:${payload.id}:${token}`;
	await redis.set(sessionKey, JSON.stringify({ ...payload, userAgent }));
	await redis.expire(sessionKey, getExpirationInSeconds());
	return generateCookie(token);
}

export async function getSession(
	request: Request,
): Promise<UserSession | null> {
	const token = extractToken(request);
	if (!token) return null;
	const keys = await redis.keys(`session:*:${token}`);
	if (!keys.length) return null;
	const raw = await redis.get(keys[0]);
	return raw ? JSON.parse(raw) : null;
}

export async function updateSession(
	request: Request,
	payload: UserSession,
	userAgent: string,
): Promise<string> {
	const token = extractToken(request);
	if (!token) throw new Error("Session token not found");
	const keys = await redis.keys(`session:*:${token}`);
	if (!keys.length) throw new Error("Session not found or expired");
	await redis.set(keys[0], JSON.stringify({ ...payload, userAgent }));
	await redis.expire(keys[0], getExpirationInSeconds());
	return generateCookie(token);
}

export async function verifySession(token: string): Promise<UserSession> {
	const keys = await redis.keys(`session:*:${token}`);
	if (!keys.length) throw new Error("Session not found or expired");
	return verifier(token);
}

export async function decodeSession(token: string): Promise<UserSession> {
	return decoder(token);
}

export async function invalidateSession(request: Request): Promise<void> {
	const token = extractToken(request);
	if (!token) return;
	const keys = await redis.keys(`session:*:${token}`);
	if (!keys.length) return;
	await redis.del(keys[0]);
}

export async function invalidateSessionById(
	sessionId: string,
): Promise<boolean> {
	const keys = await redis.keys(`session:*:${sessionId}`);
	if (!keys.length) return false;
	await redis.del(keys[0]);
	return true;
}

export async function invalidateAllSessionsForUser(
	userId: string,
): Promise<number> {
	const keys = await redis.keys(`session:${userId}:*`);
	if (keys.length === 0) return 0;

	for (const key of keys) {
		await redis.del(key);
	}

	return keys.length;
}

// helpers
function extractToken(request: Request): string | null {
	return request.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1] || null;
}

function generateCookie(
	token: string,
	maxAge = getExpirationInSeconds(),
	options?: {
		secure?: boolean;
		httpOnly?: boolean;
		sameSite?: "Strict" | "Lax" | "None";
		path?: string;
		domain?: string;
	},
): string {
	const {
		secure = !environment.development,
		httpOnly = true,
		sameSite = environment.development ? "Lax" : "None",
		path = "/",
		domain,
	} = options || {};

	let cookie = `session=${encodeURIComponent(token)}; Path=${path}; Max-Age=${maxAge}`;
	if (httpOnly) cookie += "; HttpOnly";
	if (secure) cookie += "; Secure";
	if (sameSite) cookie += `; SameSite=${sameSite}`;
	if (domain) cookie += `; Domain=${domain}`;
	return cookie;
}

function getExpirationInSeconds(): number {
	const match = jwt.expiration.match(/^(\d+)([smhd])$/);
	if (!match) throw new Error("Invalid expiresIn format in jwt config");
	const [, value, unit] = match;
	const num = Number(value);
	switch (unit) {
		case "s":
			return num;
		case "m":
			return num * 60;
		case "h":
			return num * 3600;
		case "d":
			return num * 86400;
		default:
			throw new Error("Invalid time unit in expiresIn");
	}
}

export const sessionManager = {
	createSession,
	getSession,
	updateSession,
	verifySession,
	decodeSession,
	invalidateSession,
	invalidateSessionById,
	invalidateAllSessionsForUser,
};
