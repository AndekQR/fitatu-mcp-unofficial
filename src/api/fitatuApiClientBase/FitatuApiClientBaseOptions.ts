import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";

export interface FitatuApiClientBaseOptions {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly currentUserProvider?: () => Promise<FitatuUserProfile | undefined>;
}
