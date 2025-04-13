import { resolve } from "node:path";
import { dataType } from "@config/environment";
import { s3, sql } from "bun";

import { logger } from "@/helpers/logger";
import { sessionManager } from "@/helpers/sessions";

async function deleteAvatar(
	request: ExtendedRequest,
	userID: UUID,
): Promise<[boolean, string]> {
	try {
		const [existingAvatar] =
			await sql`SELECT * FROM avatars WHERE owner = ${userID}`;

		if (!existingAvatar) {
			return [false, "No avatar found"];
		}

		const fileName: string = `${existingAvatar.owner}.${existingAvatar.extension}`;

		try {
			if (dataType.type === "local" && dataType.path) {
				await Bun.file(resolve(dataType.path, "avatars", fileName)).unlink();
			} else {
				await s3.delete(`/avatars/${fileName}`);
			}
		} catch (error) {
			logger.error(["Error deleting avatar file:", error as Error]);
			return [false, "Failed to delete avatar file"];
		}

		await sql`DELETE FROM avatars WHERE owner = ${userID}`;
		await sql`UPDATE users SET avatar = false WHERE id = ${userID}`;

		return [true, "Avatar deleted successfully"];
	} catch (error) {
		logger.error(["Error deleting avatar:", error as Error]);
		return [false, "Failed to delete avatar"];
	}
}

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

	const userID: UUID = (request.query.user as UUID) || request.session.id;
	const isAdmin: boolean = request.session.roles.includes("admin") || request.session.roles.includes("superadmin");

	if (request.session.id !== userID && !isAdmin) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Forbidden",
			},
			{ status: 403 },
		);
	}

	try {
		const [success, message] = await deleteAvatar(request, userID);

		if (!success) {
			return Response.json(
				{
					success: false,
					code: 500,
					error: message,
				},
				{ status: 500 },
			);
		}

		if (
			!(request.session as ApiUserSession).is_api &&
			request.session.id === userID
		) {
			const userSession: UserSession = {
				...request.session,
				avatar: false,
			};

			const sessionCookie: string = await sessionManager.createSession(
				userSession,
				request.headers.get("User-Agent") || "",
			);

			return Response.json(
				{
					success: true,
					code: 200,
					message: "Avatar deleted",
				},
				{
					status: 200,
					headers: {
						"Set-Cookie": sessionCookie,
					},
				},
			);
		}
		return Response.json(
			{
				success: true,
				code: 200,
				message: "Avatar deleted",
			},
			{ status: 200 },
		);
	} catch (error) {
		logger.error(["Error processing delete request:", error as Error]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "Error deleting avatar",
			},
			{ status: 500 },
		);
	}
}

export { handler, routeDef };
