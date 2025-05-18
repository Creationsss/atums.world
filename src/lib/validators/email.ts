const emailRestrictions: { regex: RegExp } = {
	regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

export function isValidEmail(email: string): {
	valid: boolean;
	error?: string;
} {
	if (!email) {
		return { valid: false, error: "" };
	}

	if (!emailRestrictions.regex.test(email)) {
		return { valid: false, error: "Invalid email address" };
	}

	return { valid: true };
}
