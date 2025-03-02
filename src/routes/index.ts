import { renderEjsTemplate } from "@helpers/ejs";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(): Promise<Response> {
	const ejsTemplateData: EjsTemplateData = {
		title: "Hello, World!",
	};

	return await renderEjsTemplate("index", ejsTemplateData);
}

export { handler, routeDef };
