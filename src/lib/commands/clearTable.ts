import { parseArgs } from "@lib/char";
import { type ReservedSQL, sql } from "bun";

(async (): Promise<void> => {
	try {
		const args: Record<string, string | boolean> = parseArgs();
		const table: string | undefined = args.table as string | undefined;
		const cascade: boolean = args.cascade === true;

		if (!table) {
			throw new Error("Missing required argument: --table <table_name>");
		}

		const reservation: ReservedSQL = await sql.reserve();

		try {
			await reservation`TRUNCATE TABLE ${sql(table)} ${cascade ? sql`CASCADE` : sql``};`;
			console.log(
				`Table ${table} has been cleared${cascade ? " with CASCADE" : ""}.`,
			);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("foreign key constraint")
			) {
				console.error(
					`Could not clear table "${table}" due to foreign key constraints.\nTry using --cascade if you want to remove dependent records.`,
				);
			} else {
				console.error("Could not clear table:", error);
			}
		} finally {
			reservation.release();
		}
	} catch (error) {
		console.error("Unexpected error:", error);
		process.exit(1);
	}
})();
