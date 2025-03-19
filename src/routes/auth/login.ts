import { getSetting } from "@config/sql/settings";
import { renderEjsTemplate } from "@helpers/ejs";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(): Promise<Response> {
	const ejsTemplateData: EjsTemplateData = {
		title: "Hello, World!",
		instance_name:
			(await getSetting("instance_name")) || "Unnamed Instance",
	};

	return await renderEjsTemplate("auth/login", ejsTemplateData);
}

export { handler, routeDef };
