import { randomUUIDv7, sql } from "bun";

import { logger } from "@creations.works/logger";
import { redis } from "bun";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (!request.session) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Unauthorized",
			},
			{ status: 403 },
		);
	}

	try {
		const [user] = await sql`
			SELECT email_verified
			FROM users
			WHERE id = ${request.session.id}
			LIMIT 1;`;

		if (!user) {
			return Response.json(
				{
					success: false,
					code: 404,
					error: "Unknown user",
				},
				{ status: 404 },
			);
		}

		if (user.email_verified) {
			return Response.json(
				{
					success: true,
					code: 200,
					message: "Email already verified",
				},
				{ status: 200 },
			);
		}

		const code: string = randomUUIDv7();
		await redis.set(
			`email:verify:${code}`,
			JSON.stringify({ user_id: request.session.id }),
		);

		// TODO: Send email when email service is implemented

		return Response.json(
			{
				success: true,
				code: 200,
				message: "Verification email sent",
			},
			{ status: 200 },
		);
	} catch (error) {
		logger.error(["Could not send email verification:", error as Error]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "Could not send email verification",
			},
			{ status: 500 },
		);
	}
}

export { handler, routeDef };
