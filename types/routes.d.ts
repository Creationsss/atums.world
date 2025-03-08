type RouteDef = {
	method: string | string[];
	accepts: string | null | string[];
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
