// import { type ReservedSQL, sql } from "bun";
//
// import { isUUID } from "@/helpers/char";
// import { logger } from "@/helpers/logger";
//
// function isValidSort(sortBy: string): boolean {
// 	const validSorts: string[] = [
// 		"size",
// 		"created_at",
// 		"expires_at",
// 		"views",
// 		"name",
// 		"original_name",
// 		"mime_type",
// 		"extension",
// 	];
// 	return validSorts.includes(sortBy);
// }
//
// function validSortOrder(sortOrder: string): string {
// 	const validSortOrder: { [key: string]: string } = {
// 		asc: "ASC",
// 		desc: "DESC",
// 		ascending: "ASC",
// 		descending: "DESC",
// 	};
//
// 	return validSortOrder[sortOrder.toLowerCase()] || "DESC";
// }
//
// const escapeLike: (value: string) => string = (value: string): string =>
// 	value.replace(/[%_\\]/g, "\\$&");
//
// const routeDef: RouteDef = {
// 	method: "GET",
// 	accepts: "*/*",
// 	returns: "application/json",
// };
//
// async function handler(request: ExtendedRequest): Promise<Response> {
// 	const {
// 		user: user_id,
// 		count = "25",
// 		page = "0",
// 		sort_by = "created_at",
// 		sort_order = "DESC",
// 		search_value,
// 	} = request.query as {
// 		user: string;
// 		count: string;
// 		page: string;
// 		sort_by: string;
// 		sort_order: string;
// 		search_value: string;
// 	};
//
// 	if (!isValidSort(sort_by)) {
// 		return Response.json(
// 			{
// 				success: false,
// 				code: 400,
// 				error: "Invalid sort_by value",
// 			},
// 			{ status: 400 },
// 		);
// 	}
//
// 	const userLookup: string | undefined = user_id || request.session?.id;
//
// 	if (!userLookup) {
// 		return Response.json(
// 			{
// 				success: false,
// 				code: 400,
// 				error: "Please provide a user ID or log in",
// 			},
// 			{ status: 400 },
// 		);
// 	}
//
// 	const isId: boolean = isUUID(userLookup);
//
// 	if (!isId) {
// 		return Response.json(
// 			{
// 				success: false,
// 				code: 400,
// 				error: "Invalid user ID",
// 			},
// 			{ status: 400 },
// 		);
// 	}
//
// 	const isSelf: boolean = request.session?.id === userLookup;
// 	const isAdmin: boolean = request.session
// 		? request.session.roles.includes("admin")
// 		: false;
//
// 	if (!isSelf && !isAdmin) {
// 		return Response.json(
// 			{
// 				success: false,
// 				code: 403,
// 				error: "Unauthorized",
// 			},
// 			{ status: 403 },
// 		);
// 	}
//
// 	const safeCount: number = Math.min(parseInt(count) || 25, 100);
// 	const safePage: number = Math.max(parseInt(page) || 0, 0);
// 	const offset: number = safePage * safeCount;
// 	let files: FileEntry[];
//
// 	const reservation: ReservedSQL = await sql.reserve();
//
// 	// ! figure out why it wont accept DESC or ASC unless it's hardcoded
// 	try {
// 		if (sort_by === "created_at" || sort_by === "expires_at") {
// 		}
//
// 		if (!files.length) {
// 			return Response.json(
// 				{
// 					success: true,
// 					code: 200,
// 					count: 0,
// 					files: [],
// 				},
// 				{ status: 200 },
// 			);
// 		}
// 	} catch (error) {
// 		logger.error(["Error fetching files", error as Error]);
// 		return Response.json(
// 			{
// 				success: false,
// 				code: 500,
// 				error: "Internal server error",
// 			},
// 			{ status: 500 },
// 		);
// 	} finally {
// 		reservation.release();
// 	}
//
// 	return Response.json(
// 		{
// 			success: true,
// 			code: 200,
// 			count: files.length,
// 			files,
// 		},
// 		{ status: 200 },
// 	);
// }
//
// export { handler, routeDef };
