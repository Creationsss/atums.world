import { isValidUsername } from "@lib/validators";
import { type ReservedSQL, sql } from "bun";

import { logger } from "@creations.works/logger";
import { isUUID } from "@lib/char";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const { query } = request.params as { query: string };
	const { invites: showInvites } = request.query as {
		invites: string;
	};

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
	let isSelf = false;
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

	const reservation: ReservedSQL = await sql.reserve();

	try {
		[user] = isId
			? await reservation`SELECT * FROM users WHERE id = ${normalized}`
			: await reservation`SELECT * FROM users WHERE username = ${normalized}`;

		if (!user) {
			return Response.json(
				{
					success: false,
					code: 404,
					error: "User not found",
				},
				{ status: 404 },
			);
		}

		isSelf = request.session ? user.id === request.session.id : false;

		const files: { count: bigint }[] =
			await reservation`SELECT COUNT(*) FROM files WHERE owner = ${user.id}`;
		const folders: { count: bigint }[] =
			await reservation`SELECT COUNT(*) FROM folders WHERE owner = ${user.id}`;

		if (files) user.files = Number(files[0].count);
		if (folders) user.folders = Number(folders[0].count);

		if (
			(showInvites === "true" || showInvites === "1") &&
			(isAdmin || isSelf)
		) {
			user.invites =
				await reservation`SELECT * FROM invites WHERE created_by = ${user.id}`;
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
	} finally {
		reservation.release();
	}

	if (!user) {
		return Response.json(
			{
				success: false,
				code: 404,
				error: "User not found",
			},
			{ status: 404 },
		);
	}

	user.password = undefined;
	user.authorization_token = undefined;
	if (!isSelf) user.email = undefined;

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
