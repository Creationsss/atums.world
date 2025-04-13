import { type ReservedSQL, type SQLQuery, sql } from "bun";

import { isUUID } from "@/helpers/char";
import { logger } from "@/helpers/logger";

function isValidSort(sortBy: string): boolean {
	const validSorts: string[] = [
		"size",
		"created_at",
		"expires_at",
		"views",
		"name",
		"original_name",
		"mime_type",
		"extension",
	];
	return validSorts.includes(sortBy);
}

function validSortOrder(sortOrder: string): string {
	const validSortOrder: { [key: string]: string } = {
		asc: "ASC",
		desc: "DESC",
		ascending: "ASC",
		descending: "DESC",
	};

	return validSortOrder[sortOrder.toLowerCase()] || "DESC";
}

const escapeLike: (value: string) => string = (value: string): string =>
	value.replace(/[%_\\]/g, "\\$&");

const routeDef: RouteDef = {
	method: "GET",
	accepts: "*/*",
	returns: "application/json",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const {
		user: user_id,
		count = "25",
		page = "0",
		sort_by = "created_at",
		sort_order = "DESC",
		search_value,
	} = request.query as {
		user: string;
		count: string;
		page: string;
		sort_by: string;
		sort_order: string;
		search_value: string;
	};

	if (!isValidSort(sort_by)) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Invalid sort_by value",
			},
			{ status: 400 },
		);
	}

	const userLookup: string | undefined = user_id || request.session?.id;

	if (!userLookup) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Please provide a user ID or log in",
			},
			{ status: 400 },
		);
	}

	const isId: boolean = isUUID(userLookup);

	if (!isId) {
		return Response.json(
			{
				success: false,
				code: 400,
				error: "Invalid user ID",
			},
			{ status: 400 },
		);
	}

	const isSelf: boolean = request.session?.id === userLookup;
	const isAdmin: boolean = request.session
		? request.session.roles.includes("admin")
		: false;

	if (!isSelf && !isAdmin) {
		return Response.json(
			{
				success: false,
				code: 403,
				error: "Unauthorized",
			},
			{ status: 403 },
		);
	}

	const safeCount: number = Math.min(Number.parseInt(count) || 25, 100);
	const safePage: number = Math.max(Number.parseInt(page) || 0, 0);
	const offset: number = safePage * safeCount;
	const sortColumn: string = sort_by || "created_at";
	const order: "ASC" | "DESC" = validSortOrder(sort_order) as "ASC" | "DESC";
	const safeSearchValue: string = escapeLike(search_value || "");

	let files: FileEntry[];
	let totalPages = 0;
	let totalFiles = 0;
	const reservation: ReservedSQL = await sql.reserve();

	try {
		// ! i really dont understand why bun wont accept reservation(order)`
		function orderBy(field_name: string, orderBy: "ASC" | "DESC"): SQLQuery {
			return reservation`ORDER BY ${reservation(field_name)} ${orderBy === "ASC" ? reservation`ASC` : reservation`DESC`}`;
		}

		files = await reservation`
			SELECT
				* FROM files
			WHERE owner = ${userLookup} AND
				(name ILIKE '%' || ${safeSearchValue} || '%' OR
				original_name ILIKE '%' || ${safeSearchValue} || '%')
			${orderBy(sortColumn, order)}
			LIMIT ${safeCount} OFFSET ${offset};
		`;

		if (!files.length) {
			return Response.json(
				{
					success: false,
					code: 404,
					error: "No files found",
				},
				{ status: 404 },
			);
		}

		[{ count: totalFiles }] = await reservation`
			SELECT COUNT(*)::int as count FROM files
			WHERE owner = ${userLookup};
		`;

		totalPages = Math.ceil(totalFiles / safeCount);
	} catch (error) {
		logger.error(["Error fetching files", error as Error]);
		return Response.json(
			{
				success: false,
				code: 500,
				error: "Internal server error",
			},
			{ status: 500 },
		);
	} finally {
		reservation.release();
	}

	return Response.json(
		{
			success: true,
			code: 200,
			total_files: totalFiles,
			total_pages: totalPages,
			files,
		},
		{ status: 200 },
	);
}

export { handler, routeDef };
