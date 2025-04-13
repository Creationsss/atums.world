import type { FunctionalComponent, JSX } from "preact";

export const Head: FunctionalComponent<Props> = ({
	title,
	styles,
	scripts,
}): JSX.Element => (
	<>
		<meta charSet="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="color-scheme" content="dark" />

		{title && <title>{title}</title>}

		<link rel="stylesheet" href="/public/css/global.css" />

		{styles?.map(
			(style): JSX.Element => (
				<link key={style} rel="stylesheet" href={`/public/css/${style}.css`} />
			),
		)}

		{scripts?.map(
			(script: string | [string, boolean]): JSX.Element | undefined => {
				if (typeof script === "string") {
					return <script src={`/public/js/${script}.js`} defer />;
				}

				if (Array.isArray(script)) {
					return (
						<script
							src={`/public/js/${script[0]}.js`}
							{...(script[1] ? { defer: true } : {})}
						/>
					);
				}
			},
		)}

		<script src="/public/js/global.js" />
	</>
);
