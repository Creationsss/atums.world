const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(): Promise<Response> {
	// TODO: Put something useful here

	return Response.json({
		message: "Hello, World!",
	});
}

export { handler, routeDef };
