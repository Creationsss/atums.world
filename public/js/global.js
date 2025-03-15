const htmlElement = document.documentElement;
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

const currentTheme =
	localStorage.getItem("theme") ||
	(prefersDarkScheme.matches ? "dark" : "light");

htmlElement.setAttribute("data-theme", currentTheme);
