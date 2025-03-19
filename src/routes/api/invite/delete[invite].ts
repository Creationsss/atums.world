import { isValidInvite } from "@config/sql/users";
import { type ReservedSQL, sql } from "bun";

import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "DELETE",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (!request.session) {
		return Response.json(
			{
				success: false,
				code: 401,
				error: "Unauthorized",
			},
			{ status: 401 },
		);
	}

	const isAdmin: boolean = request.session.roles.includes("admin");
	const { invite } = request.params as { invite: string };

	if (!invite) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Expected invite",
			},
			{ status: 400 },
		);
	}

	const { valid, error } = isValidInvite(invite);

	if (!valid && error) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: error,
			},
			{ status: 400 },
		);
	}

	const reservation: ReservedSQL = await sql.reserve();
	let inviteData: Invite | null = null;

	try {
		[inviteData] =
			await reservation`SELECT * FROM invites WHERE id = ${invite};`;

		if (!inviteData) {
			return Response.json(
				{
					success: false,
					code: 400,
					error: "Invalid invite",
				},
				{ status: 400 },
			);
		}

		if (!isAdmin && inviteData.created_by !== request.session.id) {
			return Response.json(
				{
					success: false,
					code: 403,
					error: "Unauthorized",
				},
				{ status: 403 },
			);
		}

		await reservation`DELETE FROM invites WHERE id = ${inviteData.id};`;
	} catch (error) {
		logger.error(["Could not get the invite:", error as Error]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "Internal server error",
			},
			{ status: 500 },
		);
	}

	return Response.json(
		{
			success: true,
			code: 200,
			message: "Invite deleted",
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
