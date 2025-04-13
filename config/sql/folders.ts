import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 4;

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
			CREATE TABLE IF NOT EXISTS folders (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				owner UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

				name VARCHAR(255) NOT NULL,
				public BOOLEAN NOT NULL DEFAULT FALSE,
				allow_uploads BOOLEAN NOT NULL DEFAULT FALSE,

				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);
		`;

		const functionExists: { exists: boolean }[] = await reservation`
			SELECT EXISTS (
				SELECT 1 FROM pg_proc
				JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
				WHERE proname = 'update_folders_updated_at' AND nspname = 'public'
			);
		`;

		if (!functionExists[0].exists) {
			await reservation`
				CREATE FUNCTION update_folders_updated_at()
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
				WHERE tgname = 'trigger_update_folders_updated_at'
			);
		`;

		if (!triggerExists[0].exists) {
			await reservation`
				CREATE TRIGGER trigger_update_folders_updated_at
				BEFORE UPDATE ON folders
				FOR EACH ROW
				EXECUTE FUNCTION update_folders_updated_at();
			`;
		}
	} catch (error) {
		logger.error([
			"Could not create the folders table or trigger:",
			error as Error,
		]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}
