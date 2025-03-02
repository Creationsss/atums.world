type RouteDef = {
	method: string;
	accepts: string | null;
	returns: string;
	needsBody?: "multipart" | "json";
};

type RouteModule = {
	handler: (
		request: Request,
		requestBody: unknown,
		server: BunServer,
	) => Promise<Response> | Response;
	routeDef: RouteDef;
};
