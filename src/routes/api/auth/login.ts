import {
	isValidEmail,
	isValidPassword,
	isValidUsername,
} from "@config/sql/users";
import { password as bunPassword, type ReservedSQL, sql } from "bun";

import { logger } from "@/helpers/logger";
import { sessionManager } from "@/helpers/sessions";

const routeDef: RouteDef = {
	method: "POST",
	accepts: "application/json",
	returns: "application/json",
	needsBody: "json",
};

async function handler(
	request: ExtendedRequest,
	requestBody: unknown,
): Promise<Response> {
	if (request.session) {
		if ((request.session as ApiUserSession).is_api) {
			return Response.json(
				{
					success: false,
					code: 403,
					error: "You cannot log in while using an authorization token",
				},
				{ status: 403 },
			);
		}

		return Response.json(
			{
				success: false,
				code: 403,
				error: "Already logged in",
			},
			{ status: 403 },
		);
	}

	const { username, email, password } = requestBody as {
		username: string;
		email: string;
		password: string;
	};

	if (!password || (!username && !email)) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Expected username or email, and password",
			},
			{ status: 400 },
		);
	}

	const errors: string[] = [];

	const validations: UserValidation[] = [
		username
			? { check: isValidUsername(username), field: "Username" }
			: null,
		email ? { check: isValidEmail(email), field: "Email" } : null,
		password
			? { check: isValidPassword(password), field: "Password" }
			: null,
	].filter(Boolean) as UserValidation[];

	validations.forEach(({ check }: UserValidation): void => {
		if (!check.valid && check.error) {
			errors.push(check.error);
		}
	});

	if (!username && !email) {
		errors.push("Either a username or an email is required.");
	}

	if (errors.length > 0) {
		return Response.json(
			{
				success: false,
				code: 400,
				errors,
			},
			{ status: 400 },
		);
	}

	const reservation: ReservedSQL = await sql.reserve();
	let user: User | null = null;

	try {
		[user] = await reservation`
				SELECT * FROM users
				WHERE (username = ${username} OR email = ${email})
				LIMIT 1;
			`;

		if (!user) {
			await bunPassword.verify("fake", await bunPassword.hash("fake"));

			return Response.json(
				{
					success: false,
					code: 401,
					error: "Invalid username, email, or password",
				},
				{ status: 401 },
			);
		}

		const passwordMatch: boolean = await bunPassword.verify(
			password,
			user.password,
		);

		if (!passwordMatch) {
			return Response.json(
				{
					success: false,
					code: 401,
					error: "Invalid username, email, or password",
				},
				{ status: 401 },
			);
		}
	} catch (error) {
		logger.error(["Error logging in", error as Error]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "An error occurred while logging in",
			},
			{ status: 500 },
		);
	} finally {
		if (reservation) reservation.release();
	}

	const sessionCookie: string = await sessionManager.createSession(
		{
			id: user.id,
			username: user.username,
			email: user.email,
			email_verified: user.email_verified,
			roles: user.roles[0].split(","),
			avatar: user.avatar,
			timezone: user.timezone,
			authorization_token: user.authorization_token,
		},
		request.headers.get("User-Agent") || "",
	);

	return Response.json(
		{
			success: true,
			code: 200,
		},
		{ status: 200, headers: { "Set-Cookie": sessionCookie } },
	);
}

export { handler, routeDef };
