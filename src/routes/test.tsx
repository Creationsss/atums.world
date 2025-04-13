import { HtmlShell } from "@/templates/shell";
import { render } from "preact-render-to-string";
import type { JSX } from "preact/jsx-runtime";

const routeDef = {
	method: "GET",
	accepts: "*/*",
	returns: "text/html",
};

async function handler(request: ExtendedRequest): Promise<Response> {
	const name = "test";
	const page: JSX.Element = (
		<HtmlShell title="Test Page" styles={[]} scripts={[]}>
			<div class="foo">test {name}</div>
		</HtmlShell>
	);

	return new Response(`<!DOCTYPE html>${render(page)}`, {
		headers: {
			"Content-Type": "text/html",
		},
	});
}

export { handler, routeDef };
