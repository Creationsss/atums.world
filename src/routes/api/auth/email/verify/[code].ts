import { sql } from "bun";

import { isUUID } from "@/helpers/char";
import { logger } from "@/helpers/logger";
import { redis } from "@/helpers/redis";
import { sessionManager } from "@/helpers/sessions";

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
		const verificationData: unknown = await redis
			.getInstance()
			.get("JSON", `email:verify:${code}`);

		if (!verificationData) {
			return Response.json(
				{
					success: false,
					code: 400,
					error: "Invalid verification code",
				},
				{ status: 400 },
			);
		}

		const { user_id: userId } = verificationData as {
			user_id: string;
		};

		await redis.getInstance().delete("JSON", `email:verify:${code}`);
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
