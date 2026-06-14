import type { FitatuApiClientBaseOptions } from "../FitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuCredentials } from "./FitatuCredentials.ts";

export interface FitatuAuthClientOptions extends FitatuApiClientBaseOptions {
	readonly credentialsProvider?: () => FitatuCredentials;
}
