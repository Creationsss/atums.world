const allowedAlgorithms = [
	"HS256",
	"RS256",
	"HS384",
	"HS512",
	"RS384",
	"RS512",
] as const;

type AllowedAlgorithm = (typeof allowedAlgorithms)[number];

function getAlgorithm(envVar: string | undefined): AllowedAlgorithm {
	if (allowedAlgorithms.includes(envVar as AllowedAlgorithm)) {
		return envVar as AllowedAlgorithm;
	}
	return "HS256";
}

export const jwt: {
	secret: string;
	expiration: string;
	algorithm: AllowedAlgorithm;
} = {
	secret: process.env.JWT_SECRET || "",
	expiration: process.env.JWT_EXPIRATION || "1h",
	algorithm: getAlgorithm(process.env.JWT_ALGORITHM),
};
