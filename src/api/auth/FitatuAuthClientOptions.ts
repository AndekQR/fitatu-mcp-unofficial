import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuCredentials } from "./FitatuCredentials.ts";

export interface FitatuAuthClientOptions extends Pick<FitatuApiClientBaseOptions, "baseUrl" | "fetchFn"> {
	readonly credentialsProvider?: () => FitatuCredentials;
}
