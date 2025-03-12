type FileEntry = {
	id: UUID;
	owner: UUID;
	folder?: UUID | null;

	name: string;
	original_name?: string | null;
	mime_type: string;
	extension?: string | null;
	size: number;

	views: number;
	max_views: number | null;
	password?: string | null;
	favorite: boolean;
	tags: string[];
	thumbnail: boolean;

	created_at: string;
	updated_at: string;
	expires_at?: string | null;
};

type FileUpload = Partial<FileEntry> & {
	url?: string;
};

type GetFile = Partial<FileEntry> & {
	url?: string;
	raw_url?: string;
};

type Folder = {
	id: UUID;
	owner: UUID;

	name: string;
	public: boolean;
	allow_uploads: boolean;

	created_at: string;
	updated_at: string;
};
