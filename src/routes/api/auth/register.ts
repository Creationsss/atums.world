import { getSetting } from "@config/sql/settings";
import {
	isValidEmail,
	isValidInvite,
	isValidPassword,
	isValidUsername,
} from "@config/sql/users";
import { type ReservedSQL, password as bunPassword, sql } from "bun";

import { isValidTimezone } from "@/helpers/char";
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
	const { username, email, password, invite, timezone } = requestBody as {
		username: string;
		email: string;
		password: string;
		invite?: string;
		timezone?: string;
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

	const normalizedUsername: string = username.normalize("NFC");
	const reservation: ReservedSQL = await sql.reserve();
	let firstUser = false;
	let inviteData: Invite | null = null;
	const roles: string[] = [];

	try {
		const registrationEnabled: boolean =
			(await getSetting("enable_registration", reservation)) === "true";
		const invitationsEnabled: boolean =
			(await getSetting("enable_invitations", reservation)) === "true";

		firstUser =
			Number(
				(await reservation`SELECT COUNT(*) AS count FROM users;`)[0]?.count,
			) === 0;

		let inviteValid = true;
		if (!firstUser && invite) {
			const inviteValidation: { valid: boolean; error?: string } =
				isValidInvite(invite);

			inviteValid = inviteValidation.valid;

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
		if (firstUser) roles.push("admin");

		const [result] = await reservation`
				SELECT
				EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER(${normalizedUsername})) AS "usernameExists",
				EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER(${email})) AS "emailExists";
			`;

		const { usernameExists, emailExists } = result[0] || {};

		if (usernameExists || emailExists) {
			errors.push("Username or email already exists");
		}

		if (invite && inviteValid && !firstUser) {
			[inviteData] =
				await reservation`SELECT * FROM invites WHERE id = ${invite};`;

			if (!inviteData) {
				errors.push("Invalid invite");
			}
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
	const setTimezone: string =
		timezone && isValidTimezone(timezone)
			? timezone
			: (await getSetting("default_timezone", reservation)) || "UTC";

	try {
		[user] = await reservation`
				INSERT INTO users (username, email, password, invited_by, roles, timezone)
				VALUES (${normalizedUsername}, ${email}, ${hashedPassword}, ${inviteData?.created_by}, ARRAY[${roles.join(",")}]::TEXT[], ${setTimezone})
				RETURNING *;
			`;

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

		if (invite) {
			const maxUses: number = Number(inviteData?.max_uses) || 1;
			const uses: number = Number(inviteData?.uses) || 0;

			if (uses + 1 >= maxUses) {
				await reservation`DELETE FROM invites WHERE id = ${inviteData?.id};`;
			} else {
				await reservation`UPDATE invites SET uses = ${uses + 1} WHERE id = ${inviteData?.id};`;
			}

			if (inviteData?.role) roles.push(inviteData.role);
		}
	} catch (error) {
		logger.error(["Error inserting user into the database:", error as Error]);
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

	const userSession: UserSession = {
		id: user.id,
		username: user.username,
		email: user.email,
		email_verified: user.email_verified,
		roles: user.roles[0].split(","),
		avatar: user.avatar,
		timezone: user.timezone,
		authorization_token: user.authorization_token,
	};

	const sessionCookie: string = await sessionManager.createSession(
		userSession,
		request.headers.get("User-Agent") || "",
	);

	return Response.json(
		{
			success: true,
			code: 201,
			message: "User Registered",
			user: userSession,
		},
		{ status: 201, headers: { "Set-Cookie": sessionCookie } },
	);
}

export { handler, routeDef };
