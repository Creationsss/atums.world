import { dataType } from "@config/environment";
import { s3, sql, type SQLQuery } from "bun";
import { resolve } from "path";

import { isUUID } from "@/helpers/char";
import { logger } from "@/helpers/logger";

const routeDef: RouteDef = {
	method: "DELETE",
	accepts: "*/*",
	returns: "application/json",
	needsBody: "json",
};

async function processFile(
	request: ExtendedRequest,
	file: string,
	isAdmin: boolean,
	failedFiles: { reason: string; file: string }[],
	successfulFiles: string[],
): Promise<void> {
	if (!file) {
		failedFiles.push({
			reason: "File not provided",
			file,
		});
		return;
	}

	const isID: boolean = isUUID(file);
	let fileData: FileEntry | null = null;

	try {
		let query: SQLQuery;
		if (isID) {
			query = sql`
				SELECT * FROM files WHERE id = ${file}
			`;
		} else {
			query = sql`
				SELECT * FROM files WHERE name = ${file}
			`;
		}

		const result: FileEntry[] = await query;

		if (result.length === 0) {
			failedFiles.push({
				reason: "File not found",
				file,
			});
			return;
		}

		fileData = result[0];
	} catch (error) {
		logger.error(["Failed to fetch file data", error as Error]);
		failedFiles.push({
			reason: "Failed to fetch file data",
			file,
		});
		return;
	}

	if (!isAdmin && fileData.owner !== request.session?.id) {
		failedFiles.push({
			reason: "Forbidden",
			file,
		});
	}

	// ? Unsure if this is necessary
	// if(fileData.password && !password) {
	// 	return Response.json(
	// 		{
	// 			success: false,
	// 			code: 403,
	// 			error: "Password required",
	// 		},
	// 		{ status: 403 },
	// 	);
	// }

	try {
		if (dataType.type === "local" && dataType.path) {
			const filePath: string = await resolve(
				dataType.path,
				`${fileData.id}${fileData.extension ? `.${fileData.extension}` : ""}`,
			);
			logger.info(["Deleting file", filePath]);
			await Bun.file(filePath).unlink();
		} else {
			const filePath: string = `uploads/${fileData.id}${fileData.extension ? `.${fileData.extension}` : ""}`;
			await s3.delete(filePath);
		}

		await sql`
			DELETE FROM files WHERE id = ${fileData.id}
		`;
	} catch (error) {
		logger.error(["Failed to delete file", error as Error]);
		failedFiles.push({
			reason: "Failed to delete file",
			file,
		});
	}

	successfulFiles.push(file);
	return;
}

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

	const isAdmin: boolean = request.session.roles.includes("admin");
	const { query: file } = request.params as { query: string };
	let { files } = requestBody as { files: string[] | string };
	// const { password } = request.query as { password: string };

	const failedFiles: { reason: string; file: string }[] = [];
	const successfulFiles: string[] = [];

	try {
		if (file && !(typeof file === "string" && file.length === 0)) {
			await processFile(
				request,
				file,
				isAdmin,
				failedFiles,
				successfulFiles,
			);
		} else if (files) {
			files = Array.isArray(files)
				? files
				: files.split(/[, ]+/).filter(Boolean);

			for (const file of files) {
				await processFile(
					request,
					file,
					isAdmin,
					failedFiles,
					successfulFiles,
				);
			}
		}
	} catch (error) {
		logger.error(["Unexpected error", error as Error]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "Unexpected error",
			},
			{ status: 500 },
		);
	}

	return Response.json({
		success: true,
		code: 200,
		deleted: successfulFiles,
		failed: failedFiles,
	});
}

export { handler, routeDef };
