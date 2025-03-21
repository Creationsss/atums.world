type Environment = {
	port: number;
	host: string;
	development: boolean;
};

type UserValidation = {
	check: { valid: boolean; error?: string };
	field: string;
};

type Setting = {
	key: string;
	value: string;
};

type Module = {
	file: string;
	module: {
		order?: number;
		createTable?: (reservation?: ReservedSQL) => Promise<void>;
	};
};
