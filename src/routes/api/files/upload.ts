import { getSetting } from "@config/sql/settings";
import { password as bunPassword, randomUUIDv7 } from "bun";
import { DateTime } from "luxon";

import {
	generateRandomString,
	getBaseUrl,
	getExtension,
	getNewTimeUTC,
	nameWithoutExtension,
} from "@/helpers/char";

const routeDef: RouteDef = {
	method: "POST",
	accepts: ["multipart/form-data", "text/plain", "application/json"],
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	if (!request.session || request.session === null) {
		return Response.json(
			{
				success: false,
				code: 401,
				error: "Unauthorized",
			},
			{ status: 401 },
		);
	}

	const session: UserSession | ApiUserSession = request.session;

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
			request.actualContentType === "text/plain"
				? "file.txt"
				: "file.json",
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
	const successfulFiles: string[] = [];

	formData.forEach(
		async (file: FormDataEntryValue, key: string): Promise<void> => {
			if (!(file instanceof File)) {
				failedFiles.push({
					reason: "Invalid file",
					file: key,
				});
				return;
			}

			if (!file.type || file.type === "") {
				failedFiles.push({
					reason: "Cannot determine file type",
					file: key,
				});
				return;
			}

			if (!file.size || file.size === 0) {
				failedFiles.push({
					reason: "Empty file",
					file: key,
				});
				return;
			}

			if (!file.name || file.name === "") {
				failedFiles.push({
					reason: "Missing file name",
					file: key,
				});
				return;
			}

			const extension: string | null = getExtension(file.name);
			let rawName: string | null = nameWithoutExtension(file.name);
			const maxViews: number | null =
				parseInt(user_provided_max_views, 10) || null;

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
					hashedPassword = await bunPassword.hash(
						user_provided_password,
						{
							algorithm: "argon2id",
						},
					);
				} catch (error) {
					throw error;
				}
			}

			const tags: string[] = Array.isArray(user_provided_tags)
				? user_provided_tags
				: (user_provided_tags?.split(/[, ]+/).filter(Boolean) ?? []);

			let uploadEntry: FileUpload = {
				owner: session.id as UUID,
				name: rawName,
				mime_type: file.type,
				extension: extension,
				size: file.size,
				max_views: maxViews,
				password: hashedPassword,
				favorite:
					user_wants_favorite === "true" ||
					user_wants_favorite === "1",
				tags: tags,
				expires_at: delete_short_string
					? getNewTimeUTC(delete_short_string)
					: null,
			};

			if (name_format === "date") {
				const setTimezone: string =
					session.timezone ||
					(await getSetting("default_timezone")) ||
					"UTC";
				const date: DateTime = DateTime.local().setZone(setTimezone);
				uploadEntry.name = `${date.toFormat((await getSetting("date_format")) || "yyyy-MM-dd_HH-mm-ss")}`;
			} else if (name_format === "random") {
				uploadEntry.name = generateRandomString(
					Number(await getSetting("random_name_length")) || 8,
				);
			} else if (name_format === "uuid") {
				const randomUUID: string = randomUUIDv7();
				uploadEntry.name = randomUUID;
				uploadEntry.id = randomUUID as UUID;
			} else {
				// ? Should work not sure about non-english characters
				const sanitizedFileName: string = rawName
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.replace(/[^a-zA-Z0-9._-]/g, "_")
					.toLowerCase();
				if (sanitizedFileName.length > 255)
					uploadEntry.name = sanitizedFileName.substring(0, 255);
			}

			if (uploadEntry.name !== rawName)
				uploadEntry.original_name = rawName;

			// let fileBuffer: ArrayBuffer = await file.arrayBuffer();
		},
	);

	return Response.json({
		success: true,
		files: successfulFiles,
		failed: failedFiles,
	});
}

export { handler, routeDef };
