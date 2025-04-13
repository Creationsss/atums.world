import { resolve } from "path";
import { dataType } from "@config/environment";
import { getSetting } from "@config/sql/settings";
import {
	type SQLQuery,
	password as bunPassword,
	randomUUIDv7,
	s3,
	sql,
} from "bun";
import { exiftool } from "exiftool-vendored";
import { DateTime } from "luxon";

import {
	generateRandomString,
	getBaseUrl,
	getExtension,
	getNewTimeUTC,
	nameWithoutExtension,
	supportsExif,
	supportsThumbnail,
} from "@/helpers/char";
import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "POST",
	accepts: ["multipart/form-data", "text/plain", "application/json"],
	returns: "application/json",
};

async function removeExifData(
	fileBuffer: ArrayBuffer,
	extension: string,
): Promise<ArrayBuffer> {
	const tempInputPath: string = resolve(
		"temp",
		`${generateRandomString(5)}.${extension}`,
	);

	try {
		await Bun.write(tempInputPath, fileBuffer, { createPath: true });

		const tagsToRemove: Record<string, null> = {
			GPSAltitude: null,
			GPSAltitudeRef: null,
			GPSAreaInformation: null,
			GPSCoordinates: null,
			GPSDateStamp: null,
			GPSDestBearing: null,
			GPSDateTime: null,
			GPSDestBearingRef: null,
			GPSDestDistance: null,
			GPSDestDistanceRef: null,
			GPSDestLatitude: null,
			GPSDestLatitudeRef: null,
			GPSDestLongitude: null,
			GPSDestLongitudeRef: null,
			GPSDifferential: null,
			GPSDOP: null,
			GPSHPositioningError: null,
			GPSImgDirection: null,
			GPSImgDirectionRef: null,
			GPSLatitude: null,
			GPSLatitudeRef: null,
			GPSLongitude: null,
			GPSLongitudeRef: null,
			GPSMapDatum: null,
			GPSMeasureMode: null,
			GPSPosition: null,
			GPSProcessingMethod: null,
			GPSSatellites: null,
			GPSSpeed: null,
			GPSSpeedRef: null,
			GPSStatus: null,
			GPSTimeStamp: null,
			GPSTrack: null,
			GPSTrackRef: null,
			GPSValid: null,
			GPSVersionID: null,
			GeolocationBearing: null,
			GeolocationCity: null,
			GeolocationCountry: null,
			GeolocationCountryCode: null,
			GeolocationDistance: null,
			GeolocationFeatureCode: null,
			GeolocationFeatureType: null,
			GeolocationPopulation: null,
			GeolocationPosition: null,
			GeolocationRegion: null,
			GeolocationSubregion: null,
			GeolocationTimeZone: null,
			GeolocationWarning: null,
			Location: null,
			LocationAccuracyHorizontal: null,
			LocationAreaCode: null,
			LocationInfoVersion: null,
			LocationName: null,
		};

		await exiftool.write(tempInputPath, tagsToRemove, ["-overwrite_original"]);

		return await Bun.file(tempInputPath).arrayBuffer();
	} catch (error) {
		logger.error(["Error modifying EXIF data:", error as Error]);
		return fileBuffer;
	} finally {
		try {
			await Bun.file(tempInputPath).unlink();
		} catch (cleanupError) {
			logger.error([
				"Error cleaning up temp EXIF data file:",
				cleanupError as Error,
			]);
		}
	}
}

async function processFile(
	file: File,
	key: string,
	failedFiles: { reason: string; file: string }[],
	successfulFiles: FileUpload[],
	request: ExtendedRequest,
): Promise<void> {
	const session: UserSession | ApiUserSession = request.session as
		| UserSession
		| ApiUserSession;

	const {
		max_views: user_provided_max_views,
		password: user_provided_password,
		expires: delete_short_string,
		tags: user_provided_tags,
		format: name_format = "original", // Supports original,date,random,uuid,
		folder: folder_identifier,
		favorite: user_wants_favorite,
	} = request.query as {
		max_views: string;
		password: string;
		expires: string;
		tags: string;
		format: string;
		folder: string;
		favorite: string;
	};

	const userHeaderOptions: { domain: string; clearExif: string } = {
		domain: ((): string => {
			const domainsList: string[] =
				request.headers
					.get("X-Override-Domains")
					?.split(",")
					.map((domain: string): string => domain.trim()) ?? [];
			return domainsList.length > 0
				? domainsList[Math.floor(Math.random() * domainsList.length)]
				: getBaseUrl(request);
		})(),
		clearExif: request.headers.get("X-Clear-Exif") ?? "",
	};

	const extension: string | null = getExtension(file.name);
	const rawName: string | null = nameWithoutExtension(file.name);
	const maxViews: number | null =
		Number.parseInt(user_provided_max_views, 10) || null;

	if (!rawName) {
		failedFiles.push({
			reason: "Invalid file name",
			file: key,
		});
		return;
	}

	let hashedPassword: string | null = null;

	if (user_provided_password) {
		try {
			hashedPassword = await bunPassword.hash(user_provided_password, {
				algorithm: "argon2id",
			});
		} catch (error) {
			throw error;
		}
	}

	const randomUUID: string = randomUUIDv7();
	const tags: string[] = Array.isArray(user_provided_tags)
		? user_provided_tags
		: (user_provided_tags?.split(/[, ]+/).filter(Boolean) ?? []);

	const uploadEntry: FileUpload = {
		id: randomUUID as UUID,
		owner: session.id as UUID,
		name: rawName,
		mime_type: file.type,
		extension: extension,
		size: file.size,
		max_views: maxViews,
		password: hashedPassword,
		favorite: user_wants_favorite === "true" || user_wants_favorite === "1",
		tags: tags,
		expires_at: delete_short_string ? getNewTimeUTC(delete_short_string) : null,
	};

	if (name_format === "date") {
		const setTimezone: string =
			session.timezone || (await getSetting("default_timezone")) || "UTC";
		const date: DateTime = DateTime.local().setZone(setTimezone);
		uploadEntry.name = `${date.toFormat((await getSetting("date_format")) || "yyyy-MM-dd_HH-mm-ss")}`;
	} else if (name_format === "random") {
		uploadEntry.name = generateRandomString(
			Number(await getSetting("random_name_length")) || 8,
		);
	} else if (name_format === "uuid") {
		uploadEntry.name = randomUUID;
	} else {
		// ? Should work not sure about non-english characters
		const sanitizedFileName: string = rawName
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-zA-Z0-9._-]/g, "_")
			.toLowerCase();

		uploadEntry.name =
			sanitizedFileName.length > 255
				? sanitizedFileName.substring(0, 255)
				: sanitizedFileName;

		try {
			const existingFile: FileEntry[] = await sql`
			SELECT * FROM files WHERE owner = ${session.id} AND name = ${uploadEntry.name};
		`;

			if (existingFile.length > 0) {
				const maxBaseLength: number = 255 - 6;
				uploadEntry.name = `${uploadEntry.name.substring(0, maxBaseLength)}_${generateRandomString(5)}`;
			}
		} catch (error) {
			logger.error(["Error checking for existing file:", error as Error]);

			failedFiles.push({
				reason: "Failed to check for existing file",
				file: key,
			});
			return;
		}
	}

	if (uploadEntry.name !== rawName) uploadEntry.original_name = rawName;

	let fileBuffer: ArrayBuffer = await file.arrayBuffer();

	if (
		supportsExif(file.type, extension ?? "") &&
		(userHeaderOptions.clearExif === "true" ||
			userHeaderOptions.clearExif === "1")
	) {
		fileBuffer = await removeExifData(fileBuffer, extension ?? "");
	}

	const uuidWithExtension: string = `${uploadEntry.id}${extension ? `.${extension}` : ""}`;

	let path: string;
	if (dataType.type === "local" && dataType.path) {
		path = resolve(dataType.path, uuidWithExtension);

		try {
			await Bun.write(path, fileBuffer, { createPath: true });
		} catch (error) {
			logger.error(["Error writing file to disk:", error as Error]);

			failedFiles.push({
				reason: "Failed to write file",
				file: key,
			});
			return;
		}
	} else {
		path = "/uploads/" + uuidWithExtension;

		try {
			await s3.write(path, fileBuffer);
		} catch (error) {
			logger.error(["Error writing file to S3:", error as Error]);

			failedFiles.push({
				reason: "Failed to write file",
				file: key,
			});
			return;
		}
	}

	try {
		const [result] = await sql`
			INSERT INTO files ( id, owner, folder, name, original_name, mime_type, extension, size, max_views, password, favorite, tags, expires_at )
			VALUES (
				${uploadEntry.id}, ${uploadEntry.owner}, ${folder_identifier}, ${uploadEntry.name},
				${uploadEntry.original_name}, ${uploadEntry.mime_type}, ${uploadEntry.extension},
				${uploadEntry.size}, ${uploadEntry.max_views}, ${uploadEntry.password},
				${uploadEntry.favorite}, ARRAY[${(uploadEntry.tags ?? []).map((tag: string): SQLQuery => sql`${tag}`)}]::TEXT[],
				${uploadEntry.expires_at}
			)
			RETURNING id;
		`;

		if (!result) {
			failedFiles.push({
				reason: "Failed to create file entry",
				file: key,
			});
			return;
		}
	} catch (error) {
		logger.error(["Error creating file entry:", error as Error]);

		failedFiles.push({
			reason: "Failed to create file entry",
			file: key,
		});
		return;
	}

	if (uploadEntry.password) delete uploadEntry.password;

	uploadEntry.url = `${userHeaderOptions.domain}/raw/${uploadEntry.name}`;
	successfulFiles.push(uploadEntry);
}

async function handler(request: ExtendedRequest): Promise<Response> {
	if (!request.session) {
		return Response.json(
			{
				success: false,
				code: 401,
				error: "Unauthorized",
			},
			{ status: 401 },
		);
	}

	let requestBody: FormData | null;
	if (request.actualContentType === "multipart/form-data") {
		try {
			requestBody = await request.formData();
		} catch {
			return Response.json(
				{
					success: false,
					code: 400,
					error: "Invalid form data",
				},
				{ status: 400 },
			);
		}
	} else if (
		request.actualContentType === "text/plain" ||
		request.actualContentType === "application/json"
	) {
		const body: string = await request.text();
		requestBody = new FormData();
		requestBody.append(
			"file",
			new Blob([body], { type: request.actualContentType }),
			request.actualContentType === "text/plain" ? "file.txt" : "file.json",
		);
	} else {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Invalid content type",
			},
			{ status: 400 },
		);
	}

	const formData: FormData | null = requestBody as FormData;

	if (!formData || !(requestBody instanceof FormData)) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Missing form data",
			},
			{ status: 400 },
		);
	}

	const failedFiles: { reason: string; file: string }[] = [];
	const successfulFiles: FileUpload[] = [];

	const files: { key: string; file: File }[] = [];

	formData.forEach((value: FormDataEntryValue, key: string): void => {
		if (value instanceof File) {
			files.push({ key, file: value });
		}
	});

	for (const { key, file } of files) {
		if (!file.type || file.type === "") {
			failedFiles.push({
				reason: "Cannot determine file type",
				file: key,
			});
			continue;
		}

		if (!file.size || file.size === 0) {
			failedFiles.push({
				reason: "Empty file",
				file: key,
			});
			continue;
		}

		if (!file.name || file.name === "") {
			failedFiles.push({
				reason: "Missing file name",
				file: key,
			});
			continue;
		}

		try {
			await processFile(file, key, failedFiles, successfulFiles, request);
		} catch (error) {
			logger.error(["Error processing file:", error as Error]);
			failedFiles.push({
				reason: "Unexpected error processing file",
				file: key,
			});
		}
	}

	const filesThatSupportThumbnails: FileUpload[] = successfulFiles.filter(
		(file: FileUpload): boolean => supportsThumbnail(file.mime_type as string),
	);
	if (
		(await getSetting("enable_thumbnails")) === "true" &&
		filesThatSupportThumbnails.length > 0
	) {
		try {
			const worker: Worker = new Worker("./src/helpers/workers/thumbnails.ts", {
				type: "module",
			});
			worker.postMessage({
				files: filesThatSupportThumbnails,
			});
		} catch (error) {
			logger.error(["Error starting thumbnail worker:", error as Error]);
		}
	}

	return Response.json({
		success: true,
		code: 200,
		files: successfulFiles,
		failed: failedFiles,
	});
}

export { handler, routeDef };
