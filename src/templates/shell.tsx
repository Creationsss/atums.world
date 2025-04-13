import { Head } from "@/components/head";

export function HtmlShell({ title, styles, scripts, children }: Props) {
	return (
		<html lang="en">
			<head>
				<Head title={title} styles={styles} scripts={scripts} />
			</head>
			<body>{children}</body>
		</html>
	);
}
