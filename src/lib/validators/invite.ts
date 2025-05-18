const inviteRestrictions: { min: number; max: number; regex: RegExp } = {
	min: 4,
	max: 15,
	regex: /^[a-zA-Z0-9]+$/,
};

export function isValidInvite(invite: string): {
	valid: boolean;
	error?: string;
} {
	if (!invite) {
		return { valid: false, error: "" };
	}

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
