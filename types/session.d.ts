type UserSession = {
	id: string;
	username: string;
	email: string;
	email_verified: boolean;
	roles: string[];
	avatar: boolean;
	timezone: string;
	authorization_token: string;
};

type ApiUserSession = UserSession & {
	is_api: boolean;
};

type User = {
	id: UUID;
	authorization_token: UUID;
	username: string;
	email: string;
	email_verified: boolean;
	password: string;
	avatar: boolean;
	roles: string;
	timezone: string;
	invited_by: UUID;
	created_at: Date;
	last_seen: Date;
};

type Invite = {
	id: UUID;
	created_by: UUID;
	created_at: Date;
	expiration: Date | null;
	uses: number;
	max_uses: number;
	role: string;
};

type GetUser = {
	id?: UUID;
	authorization_token?: UUID;
	username?: string;
	email?: string;
	email_verified?: boolean;
	password?: string;
	avatar?: boolean;
	roles?: string[];
	timezone?: string;
	invited_by?: UUID;
	created_at?: Date;
	last_seen?: Date;
	invites?: Invite[];
};
