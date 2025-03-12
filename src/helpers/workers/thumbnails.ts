import { dataType } from "@config/environment.ts";
import { logger } from "@helpers/logger.ts";
import { type BunFile, s3, sql } from "bun";
import ffmpeg from "fluent-ffmpeg";
import imageThumbnail from "image-thumbnail";
import { join, resolve } from "path";

declare var self: Worker;

async function generateVideoThumbnail(
	filePath: string,
	thumbnailPath: string,
): Promise<ArrayBuffer | null> {
	return new Promise(
		(
			resolve: (value: ArrayBuffer) => void,
			reject: (reason: Error) => void,
		): void => {
			ffmpeg(filePath)
				.videoFilters("thumbnail")
				.frames(1)
				.format("mjpeg")
				.output(thumbnailPath)
				.on("error", (error: Error) => {
					logger.error([
						"failed to generate thumbnail",
						error as Error,
					]);
					reject(error);
				})

				.on("end", async () => {
					const thumbnailFile: BunFile = Bun.file(thumbnailPath);
					const file: BunFile = Bun.file(filePath);
					const thumbnailArraybuffer: ArrayBuffer =
						await thumbnailFile.arrayBuffer();

					await thumbnailFile.unlink();
					await file.unlink();

					resolve(thumbnailArraybuffer);
				})
				.run();
		},
	);
}

async function generateImageThumbnail(
	filePath: string,
	thumbnailPath: string,
): Promise<ArrayBuffer> {
	return new Promise(
		async (
			resolve: (value: ArrayBuffer) => void,
			reject: (reason: Error) => void,
		) => {
			try {
				const options: {
					responseType: "buffer";
					height: number;
					jpegOptions: {
						force: boolean;
						quality: number;
					};
				} = {
					height: 320,
					responseType: "buffer",
					jpegOptions: {
						force: true,
						quality: 60,
					},
				};

				const thumbnailBuffer: Buffer = await imageThumbnail(
					filePath,
					options,
				);

				await Bun.write(thumbnailPath, thumbnailBuffer.buffer);
				resolve(await Bun.file(thumbnailPath).arrayBuffer());

				await Bun.file(filePath).unlink();
				await Bun.file(thumbnailPath).unlink();
			} catch (error) {
				reject(error as Error);
			}
		},
	);
}

async function createThumbnails(files: FileEntry[]): Promise<void> {
	const { type, path } = dataType;

	for (const file of files) {
		const { id, mime_type } = file;

		let fileArrayBuffer: ArrayBuffer | null = null;
		const isVideo: boolean = mime_type.startsWith("video/");
		const fileName: string = `${id}.${file.extension || ""}`;

		if (type === "local") {
			const filePath: string | undefined = join(path as string, fileName);

			try {
				fileArrayBuffer = await Bun.file(filePath).arrayBuffer();
			} catch {
				logger.error([
					"Could not generate thumbnail for file:",
					fileName,
				]);
				continue;
			}
		} else {
			try {
				fileArrayBuffer = await s3.file(fileName).arrayBuffer();
			} catch {
				logger.error([
					"Could not generate thumbnail for file:",
					fileName,
				]);
				continue;
			}
		}

		if (!fileArrayBuffer) {
			logger.error(["Could not generate thumbnail for file:", fileName]);
			continue;
		}

		const tempFilePath: string = resolve("temp", `${id}.tmp`);
		const tempThumbnailPath: string = resolve("temp", `${id}.jpg`);

		try {
			await Bun.write(tempFilePath, fileArrayBuffer, {
				createPath: true,
			});
		} catch (error) {
			logger.error([
				"Could not write file to temp path:",
				fileName,
				error as Error,
			]);
			continue;
		}

		try {
			const thumbnailArrayBuffer: ArrayBuffer | null = isVideo
				? await generateVideoThumbnail(tempFilePath, tempThumbnailPath)
				: await generateImageThumbnail(tempFilePath, tempThumbnailPath);

			if (!thumbnailArrayBuffer) {
				logger.error([
					"Could not generate thumbnail for file:",
					fileName,
				]);
				continue;
			}

			try {
				if (type === "local") {
					const thumbnailPath: string = join(
						path as string,
						"thumbnails",
						`${id}.jpg`,
					);

					await Bun.write(thumbnailPath, thumbnailArrayBuffer, {
						createPath: true,
					});
				} else {
					const thumbnailPath: string = `thumbnails/${id}.jpg`;

					await s3.file(thumbnailPath).write(thumbnailArrayBuffer);
				}
			} catch (error) {
				logger.error([
					"Could not write thumbnail to storage:",
					fileName,
					error as Error,
				]);
			}

			try {
				await sql`UPDATE files SET thumbnail = true WHERE id = ${id}`;
			} catch (error) {
				logger.error([
					"Could not update file with thumbnail status:",
					fileName,
					error as Error,
				]);
			}
		} catch (error) {
			logger.error([
				"An error occurred while generating thumbnail for file:",
				fileName,
				error as Error,
			]);
		}
	}
}

self.onmessage = async (event: MessageEvent): Promise<void> => {
	await createThumbnails(event.data.files);
};

self.onerror = (error: ErrorEvent): void => {
	logger.error(error);
};
