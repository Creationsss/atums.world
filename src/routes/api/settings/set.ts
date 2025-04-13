import { setSetting } from "@config/sql/settings";

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
	const { key, value } = requestBody as { key: string; value: string };

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

	if (!request.session.roles.includes("admin")) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Unauthorized",
			},
			{ status: 403 },
		);
	}

	if (!key || !value) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Expected key and value",
			},
			{ status: 400 },
		);
	}

	if (!["string", "boolean", "number"].includes(typeof value)) {
		return Response.json(
			{
				success: false,
				code: 400,
				error:
					"Expected key to be a string and value to be a string, boolean, or number",
			},
			{ status: 400 },
		);
	}

	try {
		await setSetting(key, value);
	} catch (error) {
		logger.error(["Could not set the setting:", error as Error]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "Failed to set setting",
			},
			{ status: 500 },
		);
	}

	return Response.json(
		{
			success: true,
			code: 200,
			message: "Setting set",
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
