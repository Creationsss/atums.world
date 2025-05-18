const passwordRestrictions: {
	length: { min: number; max: number };
	regex: RegExp;
} = {
	length: { min: 12, max: 64 },
	regex: /^(?=.*\p{Ll})(?=.*\p{Lu})(?=.*\d)(?=.*[^\w\s]).{12,64}$/u,
};

export function isValidPassword(password: string): {
	valid: boolean;
	error?: string;
} {
	if (!password) {
		return { valid: false, error: "" };
	}

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
			error:
				"Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
		};
	}

	return { valid: true };
}
