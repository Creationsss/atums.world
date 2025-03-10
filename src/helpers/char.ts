import { DateTime } from "luxon";

export function timestampToReadable(timestamp?: number): string {
	const date: Date =
		timestamp && !isNaN(timestamp) ? new Date(timestamp) : new Date();
	if (isNaN(date.getTime())) return "Invalid Date";
	return date.toISOString().replace("T", " ").replace("Z", "");
}

export function isUUID(uuid: string): boolean {
	const regex: RegExp =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

	return regex.test(uuid);
}

export function getNewTimeUTC(
	durationStr: string,
	from: DateTime = DateTime.utc(),
): string | null {
	const duration: DurationObject = parseDuration(durationStr);

	const newTime: DateTime = from.plus({
		years: duration.years,
		months: duration.months,
		weeks: duration.weeks,
		days: duration.days,
		hours: duration.hours,
		minutes: duration.minutes,
		seconds: duration.seconds,
	});

	return newTime.toSQL({ includeOffset: false });
}

export function parseDuration(input: string): DurationObject {
	const regex: RegExp = /(\d+)(y|mo|w|d|h|m|s)/g;
	const matches: RegExpMatchArray[] = [...input.matchAll(regex)];

	const duration: DurationObject = {
		years: 0,
		months: 0,
		weeks: 0,
		days: 0,
		hours: 0,
		minutes: 0,
		seconds: 0,
	};

	for (const match of matches) {
		const value: number = parseInt(match[1], 10);
		const unit: string = match[2];

		switch (unit) {
			case "y":
				duration.years = value;
				break;
			case "mo":
				duration.months = value;
				break;
			case "w":
				duration.weeks = value;
				break;
			case "d":
				duration.days = value;
				break;
			case "h":
				duration.hours = value;
				break;
			case "m":
				duration.minutes = value;
				break;
			case "s":
				duration.seconds = value;
				break;
		}
	}

	return duration;
}

export function isValidTimezone(timezone: string): boolean {
	return DateTime.local().setZone(timezone).isValid;
}

export function generateRandomString(length?: number): string {
	if (!length) {
		length = length || Math.floor(Math.random() * 10) + 5;
	}

	const characters: string =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result: string = "";

	for (let i: number = 0; i < length; i++) {
		result += characters.charAt(
			Math.floor(Math.random() * characters.length),
		);
	}

	return result;
}

export function getBaseUrl(request: Request): string {
	const url: URL = new URL(request.url);
	const protocol: string = url.protocol.slice(0, -1);
	const portSegment: string = url.port ? `:${url.port}` : "";

	return `${protocol}://${url.hostname}${portSegment}`;
}

// * File Specific Helpers
export function getExtension(fileName: string): string | null {
	return fileName.split(".").length > 1 && fileName.split(".").pop() !== ""
		? (fileName.split(".").pop() ?? null)
		: null;
}

export function nameWithoutExtension(fileName: string): string {
	const extension: string | null = getExtension(fileName);
	return extension ? fileName.slice(0, -extension.length - 1) : fileName;
}

export function supportsExif(mimeType: string, extension: string): boolean {
	const supportedMimeTypes: string[] = [
		"image/jpeg",
		"image/tiff",
		"image/png",
		"image/webp",
		"image/heif",
		"image/heic",
	];
	const supportedExtensions: string[] = [
		"jpg",
		"jpeg",
		"tiff",
		"png",
		"webp",
		"heif",
		"heic",
	];

	return (
		supportedMimeTypes.includes(mimeType.toLowerCase()) &&
		supportedExtensions.includes(extension.toLowerCase())
	);
}

export function supportsThumbnails(mimeType: string): boolean {
	return /^(image\/(?!svg+xml)|video\/)/i.test(mimeType);
}
