import { logger } from "@helpers/logger";
import { type ReservedSQL, sql } from "bun";

const defaultSettings: Setting[] = [
	{ key: "default_role", value: "user" },
	{ key: "default_timezone", value: "UTC" },
	{ key: "server_timezone", value: "UTC" },
	{ key: "enable_registration", value: "false" },
	{ key: "enable_invitations", value: "true" },
	{ key: "allow_user_invites", value: "false" },
	{ key: "require_email_verification", value: "false" },
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
		);`;

		for (const setting of defaultSettings) {
			await reservation`
			INSERT INTO settings ("key", "value")
			VALUES (${setting.key}, ${setting.value})
			ON CONFLICT ("key")
			DO NOTHING;`;
		}
	} catch (error) {
		logger.error(["Could not create the settings table:", error as Error]);
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
		await reservation`DROP TABLE IF EXISTS settings ${cascade ? "CASCADE" : ""};`;
	} catch (error) {
		logger.error(["Could not drop the settings table:", error as Error]);
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
