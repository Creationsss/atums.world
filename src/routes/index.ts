import { renderEjsTemplate } from "@lib/ejs";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (!request.session) {
		return Response.redirect("/auth/login");
	}

	const ejsTemplateData: EjsTemplateData = {
		title: "Hello, World!",
	};

	return await renderEjsTemplate("index", ejsTemplateData);
}

export { handler, routeDef };
