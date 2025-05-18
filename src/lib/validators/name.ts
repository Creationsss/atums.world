// ? should support non english characters but won't mess up the url
export const userNameRestrictions: {
	length: { min: number; max: number };
	regex: RegExp;
} = {
	length: { min: 3, max: 20 },
	regex: /^[\p{L}\p{N}._-]+$/u,
};

export function isValidUsername(username: string): {
	valid: boolean;
	error?: string;
} {
	if (!username) {
		return { valid: false, error: "" };
	}

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
