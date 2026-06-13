import type { FitatuApiClientBaseOptions } from "../FitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";

export interface FitatuUserClientOptions extends FitatuApiClientBaseOptions {
  readonly authClient?: FitatuAuthClient;
}
