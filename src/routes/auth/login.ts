import { getSetting } from "@config/sql/settings";
import { renderEjsTemplate } from "@helpers/ejs";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (request.session) return Response.redirect("/");

	const instanceName: string =
		(await getSetting("instance_name")) || "Unnamed Instance";

	const ejsTemplateData: EjsTemplateData = {
		title: `Login - ${instanceName}`,
		instance_name: instanceName,
	};

	return await renderEjsTemplate("auth/login", ejsTemplateData);
}

export { handler, routeDef };
