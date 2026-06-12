import type { FitatuCredentials } from "./FitatuCredentials.ts";

export interface FitatuAuthClientOptions {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly credentialsProvider?: () => FitatuCredentials;
}
