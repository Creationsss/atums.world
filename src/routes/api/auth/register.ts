import { getSetting } from "@config/sql/settings";
import {
	isValidEmail,
	isValidInvite,
	isValidPassword,
	isValidUsername,
} from "@config/sql/users";
import { password as bunPassword, type ReservedSQL, sql } from "bun";
import type { UUID } from "crypto";

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
	const { username, email, password, invite } = requestBody as {
		username: string;
		email: string;
		password: string;
		invite?: string;
	};

	if (!username || !email || !password) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Expected username, email, and password",
			},
			{ status: 400 },
		);
	}

	const errors: string[] = [];

	const validations: UserValidation[] = [
		{ check: isValidUsername(username), field: "Username" },
		{ check: isValidEmail(email), field: "Email" },
		{ check: isValidPassword(password), field: "Password" },
	];

	validations.forEach(({ check }: UserValidation): void => {
		if (!check.valid && check.error) {
			errors.push(check.error);
		}
	});

	const reservation: ReservedSQL = await sql.reserve();
	let firstUser: boolean = false;
	let invitedBy: UUID | null = null;
	let roles: string[] = [];

	try {
		const registrationEnabled: boolean =
			(await getSetting("registrationEnabled", reservation)) === "true";
		const invitationsEnabled: boolean =
			(await getSetting("invitationsEnabled", reservation)) === "true";

		firstUser =
			Number(
				(await reservation`SELECT COUNT(*) AS count FROM users;`)[0]
					?.count,
			) === 0;

		if (!firstUser && invite) {
			const inviteValidation: { valid: boolean; error?: string } =
				isValidInvite(invite);
			if (!inviteValidation.valid && inviteValidation.error) {
				errors.push(inviteValidation.error);
			}
		}

		if (
			(!firstUser && !registrationEnabled && !invite) ||
			(!firstUser && invite && !invitationsEnabled)
		) {
			errors.push("Registration is disabled");
		}

		roles.push("user");
		if (firstUser) {
			roles.push("admin");
		}

		const { usernameExists, emailExists } = await reservation`
			SELECT
				EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER(${username})) AS usernameExists,
				EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER(${email})) AS emailExists;
		`;

		if (usernameExists) errors.push("Username already exists");
		if (emailExists) errors.push("Email already exists");
		if (invite) {
			invitedBy = (
				await reservation`SELECT user_id FROM invites WHERE invite = ${invite};`
			)[0]?.id;
			if (!invitedBy) errors.push("Invalid invite code");
		}
	} catch (error) {
		errors.push("An error occurred while checking for existing users");
		logger.error(["Error checking for existing users:", error as Error]);
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

	let user: User | null = null;
	const hashedPassword: string = await bunPassword.hash(password, {
		algorithm: "argon2id",
	});
	const defaultTimezone: string =
		(await getSetting("default_timezone", reservation)) || "UTC";

	try {
		user = (
			await reservation`
				INSERT INTO users (username, email, password, invited_by, roles, timezone)
				VALUES (${username}, ${email}, ${hashedPassword}, ${invitedBy}, ARRAY[${roles.join(",")}]::TEXT[], ${defaultTimezone})
				RETURNING *;
			`
		)[0];

		if (!user) {
			logger.error("User was not created");
			return Response.json(
				{
					success: false,
					code: 500,
					error: "An error occurred with the user registration",
				},
				{ status: 500 },
			);
		}

		if (invitedBy) {
			await reservation`DELETE FROM invites WHERE invite = ${invite};`;
		}
	} catch (error) {
		logger.error([
			"Error inserting user into the database:",
			error as Error,
		]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "An error occurred while creating the user",
			},
			{ status: 500 },
		);
	} finally {
		reservation.release();
	}

	const sessionCookie: string = await sessionManager.createSession(
		{
			id: user.id,
			username: user.username,
			email: user.email,
			email_verified: user.email_verified,
			roles: user.roles,
			avatar: user.avatar,
			timezone: user.timezone,
			authorization_token: user.authorization_token,
		},
		request.headers.get("User-Agent") || "",
	);

	return Response.json(
		{
			success: true,
			code: 201,
			message: "User Registered",
			id: user.id,
		},
		{ status: 201, headers: { "Set-Cookie": sessionCookie } },
	);
}

export { handler, routeDef };
