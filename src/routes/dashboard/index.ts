import { renderEjsTemplate } from "@helpers/ejs";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	// if (!request.session) {
	// 	return Response.redirect("/auth/login");
	// }

	const ejsTemplateData: EjsTemplateData = {
		title: "Hello, World!",
		active: "dashboard",
	};

	return await renderEjsTemplate("dashboard/index.ejs", ejsTemplateData);
}

export { handler, routeDef };
