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
				error: "Not logged in",
			},
			{ status: 403 },
		);
	}

	const { session } = request;

	if ((session as ApiUserSession).is_api === true) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "You cannot use this endpoint with an authorization token",
			},
			{ status: 403 },
		);
	}

	return Response.json({
		success: true,
		session,
	});
}

export { routeDef, handler };
