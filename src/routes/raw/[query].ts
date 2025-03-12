import { dataType } from "@config/environment";
import { type BunFile, type ReservedSQL, sql } from "bun";
import { resolve } from "path";

import { isUUID, nameWithoutExtension } from "@/helpers/char";
import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "*/*",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const { query: file } = request.params as { query: string };
	const {
		password,
		download: downloadFile,
		json,
		thumbnail,
	} = request.query as {
		password: string;
		download: string;
		json: string;
		thumbnail: string;
	};

	const isAdmin: boolean = request.session
		? request.session.roles.includes("admin")
		: false;

	if (!file) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "No file specified",
			},
			{ status: 400 },
		);
	}

	const reservation: ReservedSQL = await sql.reserve();

	const rawName: string = nameWithoutExtension(file);
	const isID: boolean = isUUID(rawName);
	let fileData: FileEntry | null = null;

	try {
		let result: FileEntry[] = [];
		if (isID) {
			result = await reservation`
				SELECT * FROM files WHERE id = ${rawName}
			`;
		} else {
			result = await reservation`
				SELECT * FROM files WHERE name = ${rawName}
			`;
		}

		if (result.length === 0) {
			return Response.json(
				{
					success: false,
					code: 404,
					error: "File not found",
				},
				{ status: 404 },
			);
		}

		fileData = result[0];
	} catch (error) {
		logger.error(["Failed to fetch file data", error as Error]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "Failed to fetch file data",
			},
			{ status: 500 },
		);
	} finally {
		reservation.release();
	}

	if (
		!isAdmin &&
		fileData.owner !== request.session?.id &&
		fileData.password &&
		!password
	) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Password required",
			},
			{ status: 403 },
		);
	}

	if (
		fileData.password &&
		(await Bun.password.verify(password, fileData.password)) !== true
	) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Invalid password",
			},
			{ status: 403 },
		);
	}

	if (json === "true" || json === "1") {
		delete fileData.password;
		fileData.tags = fileData.tags = fileData.tags[0]?.trim()
			? fileData.tags[0].split(",").filter((tag: string) => tag.trim())
			: [];

		return Response.json(
			{
				success: true,
				code: 200,
				file: fileData,
			},
			{ status: 200 },
		);
	}

	const shouldShowThumbnail: boolean =
		thumbnail === "true" || thumbnail === "1";
	let path: string;
	if (dataType.type === "local" && dataType.path) {
		if (shouldShowThumbnail) {
			path = resolve(dataType.path, "thumbnails", `${fileData.id}.jpg`);
		} else {
			path = resolve(
				dataType.path,
				`${fileData.id}${
					fileData.extension ? `.${fileData.extension}` : ""
				}`,
			);
		}
	} else {
		if (shouldShowThumbnail) {
			path = `thumbnails/${fileData.id}.jpg`;
		} else {
			path = `uploads/${fileData.id}${fileData.extension ? `.${fileData.extension}` : ""}`;
		}
	}

	try {
		const bunStream: BunFile = Bun.file(path);

		return new Response(bunStream, {
			headers: {
				"Content-Type": shouldShowThumbnail
					? "image/jpeg"
					: fileData.mime_type,
				"Content-Disposition":
					downloadFile === "true" || downloadFile === "1"
						? `attachment; filename="${fileData.original_name || fileData.name}"`
						: `inline; filename="${fileData.original_name || fileData.name}"`,
			},
			status: 200,
		});
	} catch (error) {
		logger.error(["Failed to fetch file", error as Error]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "Failed to fetch file",
			},
			{ status: 500 },
		);
	}
}

export { handler, routeDef };
