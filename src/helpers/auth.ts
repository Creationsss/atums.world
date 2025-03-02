import { isUUID } from "@helpers/char";
import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export async function authByToken(
	request: ExtendedRequest,
	reservation?: ReservedSQL,
): Promise<ApiUserSession | null> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	const authorizationHeader: string | null =
		request.headers.get("Authorization");

	if (!authorizationHeader || !authorizationHeader.startsWith("Bearer "))
		return null;

	const authorizationToken: string = authorizationHeader.slice(7).trim();
	if (!authorizationToken || !isUUID(authorizationToken)) return null;

	try {
		const result: UserSession[] =
			await reservation`SELECT id, username, email, roles avatar, timezone, authorization_token FROM users WHERE authorization_token = ${authorizationToken};`;

		if (result.length === 0) return null;

		return {
			id: result[0].id,
			username: result[0].username,
			email: result[0].email,
			email_verified: result[0].email_verified,
			roles: result[0].roles,
			avatar: result[0].avatar,
			timezone: result[0].timezone,
			authorization_token: result[0].authorization_token,
			is_api: true,
		};
	} catch (error) {
		logger.error(["Could not authenticate by token:", error as Error]);
		return null;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}
