import { environment } from "@config/environment";
import { logger } from "@helpers/logger";
import {
	type BunFile,
	FileSystemRouter,
	type MatchedRoute,
	type Serve,
} from "bun";
import { resolve } from "path";

import { webSocketHandler } from "@/websocket";

import { authByToken } from "./helpers/auth";
import { sessionManager } from "./helpers/sessions";

class ServerHandler {
	private router: FileSystemRouter;

	constructor(
		private port: number,
		private host: string,
	) {
		this.router = new FileSystemRouter({
			style: "nextjs",
			dir: "./src/routes",
			fileExtensions: [".ts"],
			origin: `http://${this.host}:${this.port}`,
		});
	}

	public initialize(): void {
		const server: Serve = Bun.serve({
			port: this.port,
			hostname: this.host,
			fetch: this.handleRequest.bind(this),
			websocket: {
				open: webSocketHandler.handleOpen.bind(webSocketHandler),
				message: webSocketHandler.handleMessage.bind(webSocketHandler),
				close: webSocketHandler.handleClose.bind(webSocketHandler),
			},
		});

		logger.info(
			`Server running at http://${server.hostname}:${server.port}`,
			true,
		);

		this.logRoutes();
	}

	private logRoutes(): void {
		logger.info("Available routes:");

		const sortedRoutes: [string, string][] = Object.entries(
			this.router.routes,
		).sort(([pathA]: [string, string], [pathB]: [string, string]) =>
			pathA.localeCompare(pathB),
		);

		for (const [path, filePath] of sortedRoutes) {
			logger.info(`Route: ${path}, File: ${filePath}`);
		}
	}

	private async serveStaticFile(pathname: string): Promise<Response> {
		try {
			let filePath: string;

			if (pathname === "/favicon.ico") {
				filePath = resolve("public", "assets", "favicon.ico");
			} else {
				filePath = resolve(`.${pathname}`);
			}

			const file: BunFile = Bun.file(filePath);

			if (await file.exists()) {
				const fileContent: ArrayBuffer = await file.arrayBuffer();
				const contentType: string =
					file.type || "application/octet-stream";

				return new Response(fileContent, {
					headers: { "Content-Type": contentType },
				});
			} else {
				logger.warn(`File not found: ${filePath}`);
				return new Response("Not Found", { status: 404 });
			}
		} catch (error) {
			logger.error([
				`Error serving static file: ${pathname}`,
				error as Error,
			]);
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	private async handleRequest(
		request: ExtendedRequest,
		server: BunServer,
	): Promise<Response> {
		request.startPerf = performance.now();

		const pathname: string = new URL(request.url).pathname;
		if (pathname.startsWith("/public") || pathname === "/favicon.ico") {
			return await this.serveStaticFile(pathname);
		}

		const match: MatchedRoute | null = this.router.match(request);
		let requestBody: unknown = {};
		let response: Response;

		if (match) {
			const { filePath, params, query } = match;

			try {
				const routeModule: RouteModule = await import(filePath);
				const contentType: string | null =
					request.headers.get("Content-Type");
				const actualContentType: string | null = contentType
					? contentType.split(";")[0].trim()
					: null;

				if (
					routeModule.routeDef.needsBody === "json" &&
					actualContentType === "application/json"
				) {
					try {
						requestBody = await request.json();
					} catch {
						requestBody = {};
					}
				} else if (
					routeModule.routeDef.needsBody === "multipart" &&
					actualContentType === "multipart/form-data"
				) {
					try {
						requestBody = await request.formData();
					} catch {
						requestBody = {};
					}
				}

				if (routeModule.routeDef.method !== request.method) {
					response = Response.json(
						{
							success: false,
							code: 405,
							error: `Method ${request.method} Not Allowed, expected ${routeModule.routeDef.method}`,
						},
						{ status: 405 },
					);
				} else {
					const expectedContentType: string | null =
						routeModule.routeDef.accepts;

					const matchesAccepts: boolean =
						expectedContentType === "*/*" ||
						actualContentType === expectedContentType;

					if (!matchesAccepts) {
						response = Response.json(
							{
								success: false,
								code: 406,
								error: `Content-Type ${contentType} Not Acceptable, expected ${expectedContentType}`,
							},
							{ status: 406 },
						);
					} else {
						request.params = params;
						request.query = query;

						request.session =
							(await authByToken(request)) ||
							(await sessionManager.getSession(request));

						response = await routeModule.handler(
							request,
							requestBody,
							server,
						);

						if (routeModule.routeDef.returns !== "*/*") {
							response.headers.set(
								"Content-Type",
								routeModule.routeDef.returns,
							);
						}
					}
				}
			} catch (error: unknown) {
				logger.error([
					`Error handling route ${request.url}:`,
					error as Error,
				]);

				response = Response.json(
					{
						success: false,
						code: 500,
						error: "Internal Server Error",
					},
					{ status: 500 },
				);
			}
		} else {
			response = Response.json(
				{
					success: false,
					code: 404,
					error: "Not Found",
				},
				{ status: 404 },
			);
		}

		const headers: Headers = response.headers;
		let ip: string | null = server.requestIP(request)?.address || null;

		if (!ip) {
			ip =
				headers.get("CF-Connecting-IP") ||
				headers.get("X-Real-IP") ||
				headers.get("X-Forwarded-For") ||
				null;
		}

		logger.custom(
			`[${request.method}]`,
			`(${response.status})`,
			[
				request.url,
				`${(performance.now() - request.startPerf).toFixed(2)}ms`,
				ip || "unknown",
			],
			"90",
		);

		return response;
	}
}
const serverHandler: ServerHandler = new ServerHandler(
	environment.port,
	environment.host,
);

export { serverHandler };
