import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 5;

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
			CREATE TABLE IF NOT EXISTS files (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				owner UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				folder UUID DEFAULT NULL REFERENCES folders(id) ON DELETE SET NULL,

				name VARCHAR(255) NOT NULL,
				original_name VARCHAR(255),
				mime_type VARCHAR(255) NOT NULL,
				extension VARCHAR(255) NOT NULL,
				size BIGINT NOT NULL,

				views INTEGER DEFAULT 0,
				max_views INTEGER DEFAULT NULL,
				password TEXT DEFAULT NULL,
				favorite BOOLEAN DEFAULT FALSE,
				tags TEXT[] DEFAULT ARRAY[]::TEXT[],
				thumbnail BOOLEAN NOT NULL DEFAULT FALSE,

				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				expires_at TIMESTAMPTZ DEFAULT NULL
			);
		`;

		const functionExists: { exists: boolean }[] = await reservation`
			SELECT EXISTS (
				SELECT 1 FROM pg_proc
				JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
				WHERE proname = 'update_files_updated_at' AND nspname = 'public'
			);
		`;

		if (!functionExists[0].exists) {
			await reservation`
				CREATE FUNCTION update_files_updated_at()
				RETURNS TRIGGER AS $$
				BEGIN
					NEW.updated_at = NOW();
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql;
			`;
		}

		const triggerExists: { exists: boolean }[] = await reservation`
			SELECT EXISTS (
				SELECT 1 FROM pg_trigger
				WHERE tgname = 'trigger_update_files_updated_at'
			);
		`;

		if (!triggerExists[0].exists) {
			await reservation`
				CREATE TRIGGER trigger_update_files_updated_at
				BEFORE UPDATE ON files
				FOR EACH ROW
				EXECUTE FUNCTION update_files_updated_at();
			`;
		}
	} catch (error) {
		logger.error([
			"Could not create the files table or trigger:",
			error as Error,
		]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}
