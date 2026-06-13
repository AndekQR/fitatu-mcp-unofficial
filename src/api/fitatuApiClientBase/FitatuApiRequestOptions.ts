export interface FitatuApiRequestOptions {
  readonly method: string;
  readonly path: string;
  readonly headers?: Record<string, string | null | undefined>;
  readonly body?: string | null;
  readonly bootstrap?: boolean;
  readonly apiClusterUserId?: string;
  readonly authorizationToken?: string;
}
