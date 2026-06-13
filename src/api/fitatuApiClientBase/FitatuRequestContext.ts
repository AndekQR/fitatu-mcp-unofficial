import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";

export interface FitatuRequestContext {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly user?: FitatuUserProfile;
}
