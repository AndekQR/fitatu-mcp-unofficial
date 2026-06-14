export interface FitatuApiRequestOptions {
	readonly method: string;
	readonly path: string;
	readonly query?: Record<string, string | number | boolean | null | undefined>;
	readonly headers?: Record<string, string | null | undefined>;
	readonly body?: string | null;
}
