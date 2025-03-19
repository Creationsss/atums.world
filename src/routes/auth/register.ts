import { getSetting } from "@config/sql/settings";
import { renderEjsTemplate } from "@helpers/ejs";
import { type ReservedSQL, sql } from "bun";

import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (request.session) return Response.redirect("/");

	const reservation: ReservedSQL = await sql.reserve();
	try {
		const [firstUser] = await sql`SELECT COUNT(*) FROM users`;

		const instanceName: string =
			(await getSetting("instance_name", reservation)) ||
			"Unnamed Instance";
		const requiresInvite: boolean =
			(await getSetting("enable_invitations", reservation)) === "true" &&
			firstUser.count !== "0";

		const ejsTemplateData: EjsTemplateData = {
			title: `Register - ${instanceName}`,
			instance_name: instanceName,
			requires_invite: requiresInvite,
		};

		return await renderEjsTemplate("auth/register", ejsTemplateData);
	} catch (error) {
		logger.error(["Error rendering register page", error as Error]);
		return Response.redirect("/");
	} finally {
		reservation.release();
	}
}

export { handler, routeDef };
