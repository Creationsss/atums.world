import { frontendUrl } from "@config";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	return Response.json(
		{
			success: true,
			code: 200,
			message: `This is the api for ${frontendUrl}`,
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
