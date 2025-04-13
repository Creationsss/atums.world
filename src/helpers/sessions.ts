import { jwt } from "@config/environment";
import { environment } from "@config/environment";
import { redis } from "@helpers/redis";
import { createDecoder, createSigner, createVerifier } from "fast-jwt";

type Signer = (payload: UserSession, options?: UserSession) => string;
type Verifier = (token: string, options?: UserSession) => UserSession;
type Decoder = (token: string, options?: UserSession) => UserSession;

class SessionManager {
	private signer: Signer;
	private verifier: Verifier;
	private decoder: Decoder;

	constructor() {
		this.signer = createSigner({
			key: jwt.secret,
			expiresIn: jwt.expiresIn,
		});
		this.verifier = createVerifier({ key: jwt.secret });
		this.decoder = createDecoder();
	}

	public async createSession(
		payload: UserSession,
		userAgent: string,
	): Promise<string> {
		const token: string = this.signer(payload);
		const sessionKey: string = `session:${payload.id}:${token}`;

		await redis
			.getInstance()
			.set(
				"JSON",
				sessionKey,
				{ ...payload, userAgent },
				this.getExpirationInSeconds(),
			);

		const cookie: string = this.generateCookie(token);
		return cookie;
	}

	public async getSession(request: Request): Promise<UserSession | null> {
		const cookie: string | null = request.headers.get("Cookie");
		if (!cookie) return null;

		const token: string | null = cookie.match(/session=([^;]+)/)?.[1] || null;
		if (!token) return null;

		const userSessions: string[] = await redis
			.getInstance()
			.keys(`session:*:${token}`);
		if (!userSessions.length) return null;

		const sessionData: unknown = await redis
			.getInstance()
			.get("JSON", userSessions[0]);
		if (!sessionData) return null;

		const payload: UserSession & { userAgent: string } =
			sessionData as UserSession & { userAgent: string };
		return payload;
	}

	public async updateSession(
		request: Request,
		payload: UserSession,
		userAgent: string,
	): Promise<string> {
		const cookie: string | null = request.headers.get("Cookie");
		if (!cookie) throw new Error("No session found in request");

		const token: string | null = cookie.match(/session=([^;]+)/)?.[1] || null;
		if (!token) throw new Error("Session token not found");

		const userSessions: string[] = await redis
			.getInstance()
			.keys(`session:*:${token}`);
		if (!userSessions.length) throw new Error("Session not found or expired");

		const sessionKey: string = userSessions[0];

		await redis
			.getInstance()
			.set(
				"JSON",
				sessionKey,
				{ ...payload, userAgent },
				this.getExpirationInSeconds(),
			);

		return this.generateCookie(token);
	}

	public async verifySession(token: string): Promise<UserSession> {
		const userSessions: string[] = await redis
			.getInstance()
			.keys(`session:*:${token}`);
		if (!userSessions.length) throw new Error("Session not found or expired");

		const sessionData: unknown = await redis
			.getInstance()
			.get("JSON", userSessions[0]);
		if (!sessionData) throw new Error("Session not found or expired");

		const payload: UserSession = this.verifier(token);
		return payload;
	}

	public async decodeSession(token: string): Promise<UserSession> {
		const payload: UserSession = this.decoder(token);
		return payload;
	}

	public async invalidateSession(request: Request): Promise<void> {
		const cookie: string | null = request.headers.get("Cookie");
		if (!cookie) return;

		const token: string | null = cookie.match(/session=([^;]+)/)?.[1] || null;
		if (!token) return;

		const userSessions: string[] = await redis
			.getInstance()
			.keys(`session:*:${token}`);
		if (!userSessions.length) return;

		await redis.getInstance().delete("JSON", userSessions[0]);
	}

	private generateCookie(
		token: string,
		maxAge: number = this.getExpirationInSeconds(),
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

	private getExpirationInSeconds(): number {
		const match: RegExpMatchArray | null =
			jwt.expiresIn.match(/^(\d+)([smhd])$/);
		if (!match) {
			throw new Error("Invalid expiresIn format in jwt config");
		}

		const [, value, unit] = match;
		const num: number = Number.parseInt(value, 10);

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
}

const sessionManager: SessionManager = new SessionManager();
export { sessionManager };
