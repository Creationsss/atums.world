import { sessionManager } from "@/helpers/sessions";

const routeDef: RouteDef = {
	method: "POST",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (!request.session) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "You are not logged in",
			},
			{ status: 403 },
		);
	}

	if ((request.session as ApiUserSession).is_api) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "You cannot logout while using an authorization token",
			},
			{ status: 403 },
		);
	}

	sessionManager.invalidateSession(request);

	return Response.json(
		{
			success: true,
			code: 200,
			message: "Successfully logged out",
		},
		{
			status: 200,
			headers: {
				"Set-Cookie":
					"session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
			},
		},
	);
}

export { handler, routeDef };
