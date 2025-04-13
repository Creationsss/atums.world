import { resolve } from "node:path";
import { dataType } from "@config/environment";
import { isValidTypeOrExtension } from "@config/sql/avatars";
import { getSetting } from "@config/sql/settings";
import { s3, sql } from "bun";

import { getBaseUrl, getExtension } from "@/helpers/char";
import { logger } from "@/helpers/logger";
import { sessionManager } from "@/helpers/sessions";

async function processFile(
	file: File,
	request: ExtendedRequest,
	userID: UUID,
): Promise<[boolean, string]> {
	const extension: string | null = getExtension(file.name);
	if (!extension) return [false, "Invalid file extension"];
	if (!isValidTypeOrExtension(file.type, extension))
		return [false, "Invalid file type"];

	const maxSize: bigint = BigInt(
		(await getSetting("max_avatar_size")) || "10000000", // Default 10MB
	);
	if (file.size > maxSize)
		return [false, `Avatar is too large (max ${maxSize} bytes)`];

	const avatarEntry: AvatarUpload = {
		owner: userID,
		mime_type: file.type,
		extension,
		size: file.size,
	};

	const fileBuffer: ArrayBuffer = await file.arrayBuffer();
	const fileName: string = `${avatarEntry.owner}.${extension}`;

	try {
		const [existingAvatar] =
			await sql`SELECT * FROM avatars WHERE owner = ${userID}`;

		if (existingAvatar) {
			const existingFileName: string = `${existingAvatar.owner}.${existingAvatar.extension}`;

			try {
				if (dataType.type === "local" && dataType.path) {
					await Bun.file(
						resolve(dataType.path, "avatars", existingFileName),
					).unlink();
				} else {
					await s3.delete(`/avatars/${existingFileName}`);
				}
			} catch (error) {
				logger.error(["Error deleting existing avatar file:", error as Error]);
			}
		}

		await sql`DELETE FROM avatars WHERE owner = ${userID}`;
		await sql`INSERT INTO avatars ${sql(avatarEntry)}`;

		const path: string =
			dataType.type === "local" && dataType.path
				? resolve(dataType.path, "avatars", fileName)
				: `/avatars/${fileName}`;

		try {
			if (dataType.type === "local" && dataType.path) {
				await Bun.write(path, fileBuffer, { createPath: true });
			} else {
				await s3.write(path, fileBuffer);
			}
		} catch (error) {
			logger.error(["Error writing avatar file:", error as Error]);
			await sql`DELETE FROM avatars WHERE owner = ${userID}`;
			return [false, "Failed to write file"];
		}

		await sql`UPDATE users SET avatar = true WHERE id = ${userID}`;

		return [true, `${getBaseUrl(request)}/user/avatar/${fileName}`];
	} catch (error) {
		logger.error(["Error processing avatar:", error as Error]);
		await sql`DELETE FROM avatars WHERE owner = ${userID}`;
		return [false, "Failed to process avatar"];
	}
}

const routeDef: RouteDef = {
	method: "POST",
	accepts: "multipart/form-data",
	returns: "application/json",
	needsBody: "multipart",
};

async function handler(
	request: ExtendedRequest,
	requestBody: unknown,
): Promise<Response> {
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

	const formData: FormData | null = requestBody as FormData;
	const userID: UUID = (request.query.user as UUID) || request.session.id;
	const isAdmin: boolean = request.session
		? request.session.roles.includes("admin")
		: false;

	if (request.session.id !== userID && !isAdmin) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Forbidden",
			},
			{ status: 403 },
		);
	}

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

	const file: File | null =
		(formData.get("file") as File) || (formData.get("avatar") as File) || null;

	if (!file.type || file.type === "") {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Missing file type",
			},
			{ status: 400 },
		);
	}

	if (!file.size || file.size === 0) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Missing file size",
			},
			{ status: 400 },
		);
	}

	try {
		const [success, message] = await processFile(file, request, userID);

		if (!success) {
			return Response.json(
				{
					success: false,
					code: 500,
					error: message,
				},
				{ status: 500 },
			);
		}

		if (
			!(request.session as ApiUserSession).is_api &&
			request.session.id === userID
		) {
			const userSession: UserSession = {
				...request.session,
				avatar: true,
			};

			const sessionCookie: string = await sessionManager.createSession(
				userSession,
				request.headers.get("User-Agent") || "",
			);

			return Response.json(
				{
					success: true,
					code: 200,
					message: "Avatar uploaded",
					url: message,
				},
				{
					status: 200,
					headers: {
						"Set-Cookie": sessionCookie,
					},
				},
			);
		}
		return Response.json(
			{
				success: true,
				code: 200,
				message: "Avatar uploaded",
				url: message,
			},
			{ status: 200 },
		);
	} catch (error) {
		logger.error(["Error processing file:", error as Error]);

		return Response.json(
			{
				success: false,
				code: 500,
				error: "Error processing file",
			},
			{ status: 500 },
		);
	}
}
export { handler, routeDef };
