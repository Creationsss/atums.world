import { getSetting } from "@config/sql/settings";
import { sql } from "bun";

import { generateRandomString, getNewTimeUTC } from "@/helpers/char";
import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "POST",
	accepts: "application/json",
	returns: "application/json",
	needsBody: "json",
};

async function handler(
	request: ExtendedRequest,
	requestBody: unknown,
): Promise<Response> {
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

	if (!getSetting("enable_invitations")) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Invitations are disabled",
			},
			{ status: 403 },
		);
	}

	const isAdmin: boolean = request.session.roles.includes("admin") || request.session.roles.includes("superadmin");

	if (!isAdmin && !getSetting("allow_user_invites")) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "User invitations are disabled",
			},
			{ status: 403 },
		);
	}

	const { expires, max_uses, role } = requestBody as {
		expires?: string;
		max_uses?: number;
		role?: string;
	};

	if (role && !isAdmin) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "You must be an admin to set the role",
			},
			{ status: 403 },
		);
	}

	const expirationDate: string | null = expires ? getNewTimeUTC(expires) : null;
	const maxUses: number = Number(max_uses) || 1;
	const inviteRole: string = role || "user";

	let invite: Invite | null = null;
	try {
		[invite] = await sql`
			INSERT INTO invites (created_by, expiration, max_uses, role, id)
			VALUES (${request.session.id}, ${expirationDate}, ${maxUses}, ${inviteRole}, ${generateRandomString(15)})
			RETURNING *;
		`;

		if (!invite) {
			logger.error("Invite failed to create");

			return Response.json(
				{
					success: false,
					code: 500,
					error: "Invite was not created",
				},
				{ status: 500 },
			);
		}
	} catch (error) {
		logger.error(["Error creating invite:", error as Error]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "An error occurred while creating the invite",
			},
			{ status: 500 },
		);
	}

	return Response.json(
		{
			success: true,
			code: 200,
			invite: {
				code: invite.id,
				expiration: invite.expiration,
				max_uses: invite.max_uses,
				role: invite.role,
			},
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
