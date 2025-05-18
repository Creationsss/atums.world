import { logger } from "@creations.works/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 1;

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation = false;
	const activeReservation: ReservedSQL = reservation ?? (await sql.reserve());

	if (!reservation) {
		selfReservation = true;
	}

	try {
		await activeReservation`
			CREATE TABLE IF NOT EXISTS users (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				authorization_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
				username VARCHAR(20) NOT NULL UNIQUE,
				email VARCHAR(254) NOT NULL UNIQUE,
				email_verified boolean NOT NULL DEFAULT false,
				password TEXT NOT NULL,
				avatar boolean NOT NULL DEFAULT false,
				roles TEXT[] NOT NULL DEFAULT ARRAY['user'],
				timezone VARCHAR(64) DEFAULT NULL,
				invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);`;
	} catch (error) {
		logger.error(["Could not create the users table:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			activeReservation.release();
		}
	}
}
