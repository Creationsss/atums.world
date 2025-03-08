type DurationObject = {
	years: number;
	months: number;
	weeks: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
};

type UUID = `${string}-${string}-${string}-${string}-${string}`;
type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
