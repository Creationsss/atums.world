/** @type {import('stylelint').Config} */
export default {
	extends: ["stylelint-config-standard"],
	rules: {
		"color-function-notation": "modern",
		"font-family-name-quotes": "always-where-required",
		"declaration-empty-line-before": "never",
	},
};
