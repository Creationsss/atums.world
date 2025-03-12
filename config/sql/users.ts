import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 1;

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
			CREATE TABLE IF NOT EXISTS users (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				authorization_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
				username VARCHAR(20) NOT NULL UNIQUE,
				email VARCHAR(254) NOT NULL UNIQUE,
				email_verified boolean NOT NULL DEFAULT false,
				password TEXT NOT NULL,
				avatar boolean NOT NULL DEFAULT false,
				roles TEXT[] NOT NULL DEFAULT ARRAY['user'],
				timezone VARCHAR(64) DEFAULT NULL,
				invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);`;
	} catch (error) {
		logger.error(["Could not create the users table:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}

// * Validation functions

// ? should support non english characters but won't mess up the url
export const userNameRestrictions: {
	length: { min: number; max: number };
	regex: RegExp;
} = {
	length: { min: 3, max: 20 },
	regex: /^[\p{L}\p{N}._-]+$/u,
};

export const passwordRestrictions: {
	length: { min: number; max: number };
	regex: RegExp;
} = {
	length: { min: 12, max: 64 },
	regex: /^(?=.*\p{Ll})(?=.*\p{Lu})(?=.*\d)(?=.*[^\w\s]).{12,64}$/u,
};

export const emailRestrictions: { regex: RegExp } = {
	regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

export const inviteRestrictions: { min: number; max: number; regex: RegExp } = {
	min: 4,
	max: 15,
	regex: /^[a-zA-Z0-9]+$/,
};

export function isValidUsername(username: string): {
	valid: boolean;
	error?: string;
} {
	if (username.length < userNameRestrictions.length.min) {
		return { valid: false, error: "Username is too short" };
	}

	if (username.length > userNameRestrictions.length.max) {
		return { valid: false, error: "Username is too long" };
	}

	if (!userNameRestrictions.regex.test(username)) {
		return { valid: false, error: "Username contains invalid characters" };
	}

	return { valid: true };
}

export function isValidPassword(password: string): {
	valid: boolean;
	error?: string;
} {
	if (password.length < passwordRestrictions.length.min) {
		return {
			valid: false,
			error: `Password must be at least ${passwordRestrictions.length.min} characters long`,
		};
	}

	if (password.length > passwordRestrictions.length.max) {
		return {
			valid: false,
			error: `Password can't be longer than ${passwordRestrictions.length.max} characters`,
		};
	}

	if (!passwordRestrictions.regex.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
		};
	}

	return { valid: true };
}

export function isValidEmail(email: string): {
	valid: boolean;
	error?: string;
} {
	if (!emailRestrictions.regex.test(email)) {
		return { valid: false, error: "Invalid email address" };
	}

	return { valid: true };
}

export function isValidInvite(invite: string): {
	valid: boolean;
	error?: string;
} {
	if (invite.length < inviteRestrictions.min) {
		return {
			valid: false,
			error: `Invite code must be at least ${inviteRestrictions.min} characters long`,
		};
	}

	if (invite.length > inviteRestrictions.max) {
		return {
			valid: false,
			error: `Invite code can't be longer than ${inviteRestrictions.max} characters`,
		};
	}

	if (!inviteRestrictions.regex.test(invite)) {
		return {
			valid: false,
			error: "Invite code contains invalid characters",
		};
	}

	return { valid: true };
}
