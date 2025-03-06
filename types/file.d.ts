type File = {
	id: UUID;
	owner: UUID;
	folder?: UUID | null;

	name: string;
	original_name?: string | null;
	mime_type: string;
	size: number;

	views: number;
	max_views: number;
	password?: string | null;
	favorite: boolean;
	tags: string[];
	thumbnail: boolean;

	created_at: Date;
	updated_at: Date;
	expires_at?: Date | null;
};

type Folder = {
	id: UUID;
	owner: UUID;

	name: string;
	public: boolean;
	allow_uploads: boolean;

	created_at: Date;
	updated_at: Date;
};
