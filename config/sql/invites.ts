import { logger } from "@creations.works/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 3;

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation = false;
	const activeReservation: ReservedSQL = reservation ?? (await sql.reserve());

	if (!reservation) {
		selfReservation = true;
	}

	try {
		await activeReservation`
			CREATE TABLE IF NOT EXISTS invites (
				id TEXT PRIMARY KEY NOT NULL UNIQUE,
				created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				expiration TIMESTAMPTZ DEFAULT NULL,
				uses INTEGER DEFAULT 0,
				max_uses INTEGER DEFAULT 1,
				role TEXT NOT NULL DEFAULT 'user'
			);`;
	} catch (error) {
		logger.error(["Could not create the invites table:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			activeReservation.release();
		}
	}
}
