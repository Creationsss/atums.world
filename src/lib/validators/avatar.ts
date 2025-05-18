export function isValidTypeOrExtension(
	type: string,
	extension: string,
): boolean {
	return (
		["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type) &&
		["jpeg", "jpg", "png", "gif", "webp"].includes(extension)
	);
}
