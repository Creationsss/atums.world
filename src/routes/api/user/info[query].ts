import { isValidUsername } from "@config/sql/users";
import { sql } from "bun";

import { isUUID } from "@/helpers/char";
import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const { query } = request.params as { query: string };
	const { invites: showInvites } = request.query as { invites: string };

	if (!query) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Username or user ID is required",
			},
			{ status: 400 },
		);
	}

	let user: GetUser | null = null;
	let isSelf: boolean = false;
	const isId: boolean = isUUID(query);
	const normalized: string = isId ? query : query.normalize("NFC");
	const isAdmin: boolean = request.session
		? request.session.roles.includes("admin")
		: false;

	if (!isId && !isValidUsername(normalized).valid) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Invalid username",
			},
			{ status: 400 },
		);
	}

	try {
		const result: GetUser[] = isId
			? await sql`SELECT * FROM users WHERE id = ${normalized}`
			: await sql`SELECT * FROM users WHERE username = ${normalized}`;

		if (result.length === 0) {
			return Response.json(
				{
					success: false,
					code: 404,
					error: "User not found",
				},
				{ status: 404 },
			);
		}

		user = result[0];
		isSelf = request.session ? user.id === request.session.id : false;

		if (
			(showInvites === "true" || showInvites === "1") &&
			(isAdmin || isSelf)
		) {
			const invites: Invite[] =
				await sql`SELECT * FROM invites WHERE created_by = ${user.id}`;
			user.invites = invites;
		}
	} catch (error) {
		logger.error([
			"An error occurred while fetching user data",
			error as Error,
		]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "An error occurred while fetching user data",
			},
			{ status: 500 },
		);
	}

	delete user.password;
	delete user.authorization_token;
	if (!isSelf) delete user.email;

	user.roles = user.roles ? user.roles[0].split(",") : [];

	return Response.json(
		{
			success: true,
			code: 200,
			user: user,
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
