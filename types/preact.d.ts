type Props = {
	title?: string;
	styles?: string[];
	scripts?: (string | [string, boolean])[];
	children?: preact.ComponentChildren;
};
