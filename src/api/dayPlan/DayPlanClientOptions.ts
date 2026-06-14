import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuUserClient } from "../users/FitatuUserClient.ts";

export interface DayPlanClientOptions extends FitatuApiClientBaseOptions {
	readonly userClient?: FitatuUserClient;
}
