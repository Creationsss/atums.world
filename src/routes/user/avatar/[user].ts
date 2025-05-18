import { resolve } from "node:path";
import { dataType } from "@config";
import { isValidUsername } from "@lib/validators";
import { type BunFile, type ReservedSQL, sql } from "bun";

import { logger } from "@creations.works/logger";
import { getBaseUrl, isUUID, nameWithoutExtension } from "@lib/char";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "*/*",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const { user: query } = request.params as { user: string };
	const { json, download } = request.query as {
		json?: string;
		download?: string;
	};

	if (!query) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "User username or ID is required",
			},
			{ status: 400 },
		);
	}

	const noEXT: string = nameWithoutExtension(query);
	const isId: boolean = isUUID(noEXT);
	const normalized: string = isId ? noEXT : noEXT.normalize("NFC");

	if (!isId && !isValidUsername(normalized).valid) {
		return Response.json(
			{ success: false, code: 400, error: "Invalid username" },
			{ status: 400 },
		);
	}

	const reservation: ReservedSQL = await sql.reserve();

	try {
		const [user] = isId
			? await reservation`SELECT * FROM users WHERE id = ${normalized}`
			: await reservation`SELECT * FROM users WHERE username = ${normalized}`;

		if (!user)
			return Response.json(
				{ success: false, code: 404, error: "User not found" },
				{ status: 404 },
			);
		if (!user.avatar)
			return Response.json(
				{ success: false, code: 404, error: "User has no avatar" },
				{ status: 404 },
			);

		const [avatar] =
			await reservation`SELECT * FROM avatars WHERE owner = ${user.id}`;

		if (!avatar)
			return Response.json(
				{ success: false, code: 404, error: "Avatar not found" },
				{ status: 404 },
			);

		if (json === "true" || json === "1") {
			return Response.json(
				{
					success: true,
					code: 200,
					avatar: {
						...avatar,
						url: `${getBaseUrl(request)}/user/avatar/${user.id}`,
					},
				},
				{ status: 200 },
			);
		}

		let path: string;
		if (dataType.type === "local" && dataType.path) {
			path = resolve(
				dataType.path,
				"avatars",
				`${avatar.id}.${avatar.extension}`,
			);
		} else {
			path = `/avatars/${avatar.id}.${avatar.extension}`;
		}

		try {
			const bunStream: BunFile = Bun.file(path);

			return new Response(bunStream, {
				headers: {
					"Content-Type": avatar.mime_type,
					"Content-Length": avatar.size.toString(),
					"Content-Disposition":
						download === "true" || download === "1"
							? `attachment; filename="${avatar.id}.${avatar.extension}"`
							: `inline; filename="${avatar.id}.${avatar.extension}"`,
				},
				status: 200,
			});
		} catch (error) {
			logger.error(["Failed to fetch avatar", error as Error]);
			return Response.json(
				{ success: false, code: 500, error: "Failed to fetch avatar" },
				{ status: 500 },
			);
		}
	} catch (error) {
		logger.error(["Error fetching avatar:", error as Error]);
		return Response.json(
			{ success: false, code: 500, error: "Failed to fetch avatar" },
			{ status: 500 },
		);
	} finally {
		reservation.release();
	}
}

export { handler, routeDef };
