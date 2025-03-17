import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 6;

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
			CREATE TABLE IF NOT EXISTS avatars (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				owner UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				mime_type VARCHAR(255) NOT NULL,
				extension VARCHAR(255) NOT NULL,
				size BIGINT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);
		`;
	} catch (error) {
		logger.error(["Could not create the avatars table:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}

export function isValidTypeOrExtension(
	type: string,
	extension: string,
): boolean {
	return (
		["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type) &&
		["jpeg", "jpg", "png", "gif", "webp"].includes(extension)
	);
}
