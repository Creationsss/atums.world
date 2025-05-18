import { redis, sql } from "bun";

import { sessionManager } from "@/lib/jwt";
import { logger } from "@creations.works/logger";
import { isUUID } from "@lib/char";

const routeDef: RouteDef = {
	method: "POST",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const { code } = request.params as { code: string };

	if (!code) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Missing verification code",
			},
			{ status: 400 },
		);
	}

	if (!isUUID(code)) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Invalid verification code",
			},
			{ status: 400 },
		);
	}

	try {
		const raw: string | null = await redis.get(`email:verify:${code}`);

		if (!raw) {
			return Response.json(
				{
					success: false,
					code: 400,
					error: "Invalid verification code",
				},
				{ status: 400 },
			);
		}

		let verificationData: { user_id: string };

		try {
			verificationData = JSON.parse(raw);
		} catch {
			return Response.json(
				{
					success: false,
					code: 400,
					error: "Malformed verification data",
				},
				{ status: 500 },
			);
		}

		const { user_id: userId } = verificationData;

		await redis.del(`email:verify:${code}`);
		await sql`
			UPDATE users
			SET email_verified = true
			WHERE id = ${userId};`;
	} catch (error) {
		logger.error(["Could not verify email:", error as Error]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "Could not verify email",
			},
			{ status: 500 },
		);
	}

	if (request.session) {
		await sessionManager.updateSession(
			request,
			{ ...request.session, email_verified: true },
			request.headers.get("User-Agent") || "",
		);
	}

	return Response.json(
		{
			success: true,
			code: 200,
			message: "Email has been verified",
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
