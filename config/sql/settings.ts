import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

export const order: number = 2;

const defaultSettings: Setting[] = [
	{ key: "default_role", value: "user" },
	{ key: "default_timezone", value: "UTC" },
	{ key: "server_timezone", value: "UTC" },
	{ key: "enable_registration", value: "false" },
	{ key: "enable_invitations", value: "true" },
	{ key: "allow_user_invites", value: "false" },
	{ key: "require_email_verification", value: "false" },
	{ key: "date_format", value: "yyyy-MM-dd_HH-mm-ss" },
	{ key: "random_name_length", value: "8" },
	{ key: "enable_thumbnails", value: "true" },
	{ key: "index_page_stats", value: "true" },
];

export async function createTable(reservation?: ReservedSQL): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
			CREATE TABLE IF NOT EXISTS settings (
				"key" VARCHAR(64) PRIMARY KEY NOT NULL UNIQUE,
				"value" TEXT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);
		`;

		const functionExists: { exists: boolean }[] = await reservation`
			SELECT EXISTS (
				SELECT 1 FROM pg_proc
				JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
				WHERE proname = 'update_settings_updated_at' AND nspname = 'public'
			);
		`;

		if (!functionExists[0].exists) {
			await reservation`
				CREATE FUNCTION update_settings_updated_at()
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
				WHERE tgname = 'trigger_update_settings_updated_at'
			);
		`;

		if (!triggerExists[0].exists) {
			await reservation`
				CREATE TRIGGER trigger_update_settings_updated_at
				BEFORE UPDATE ON settings
				FOR EACH ROW
				EXECUTE FUNCTION update_settings_updated_at();
			`;
		}

		for (const setting of defaultSettings) {
			await reservation`
				INSERT INTO settings ("key", "value")
				VALUES (${setting.key}, ${setting.value})
				ON CONFLICT ("key") DO NOTHING;
			`;
		}
	} catch (error) {
		logger.error([
			"Could not create the settings table or trigger:",
			error as Error,
		]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}

// * Validation functions

export async function getSetting(
	key: string,
	reservation?: ReservedSQL,
): Promise<string | null> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		const result: { value: string }[] =
			await reservation`SELECT value FROM settings WHERE "key" = ${key};`;

		if (result.length === 0) {
			return null;
		}

		return result[0].value;
	} catch (error) {
		logger.error(["Could not get the setting:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}

export async function setSetting(
	key: string,
	value: string,
	reservation?: ReservedSQL,
): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`
			INSERT INTO settings ("key", "value", updated_at)
			VALUES (${key}, ${value}, NOW())
			ON CONFLICT ("key")
			DO UPDATE SET "value" = ${value}, "updated_at" = NOW();`;
	} catch (error) {
		logger.error(["Could not set the setting:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}

export async function deleteSetting(
	key: string,
	reservation?: ReservedSQL,
): Promise<void> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		await reservation`DELETE FROM settings WHERE "key" = ${key};`;
	} catch (error) {
		logger.error(["Could not delete the setting:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}

export async function getAllSettings(
	reservation?: ReservedSQL,
): Promise<{ key: string; value: string }[]> {
	let selfReservation: boolean = false;

	if (!reservation) {
		reservation = await sql.reserve();
		selfReservation = true;
	}

	try {
		const result: { key: string; value: string }[] =
			await reservation`SELECT "key", "value" FROM settings;`;

		return result;
	} catch (error) {
		logger.error(["Could not get all settings:", error as Error]);
		throw error;
	} finally {
		if (selfReservation) {
			reservation.release();
		}
	}
}
