import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
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
			reservation.release();
		}
	}
}

export async function drop(
	cascade: boolean,
	reservation?: ReservedSQL,
): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`DROP TABLE IF EXISTS invites ${cascade ? "CASCADE" : ""};`;
	} catch (error) {
		logger.error(["Could not drop the invites table:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}
