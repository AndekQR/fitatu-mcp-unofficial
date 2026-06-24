/** Raw JSON object returned by GET /diet-and-activity-plan/{userId}/day/{date}. */
export interface GetDayResponse {
	readonly dietPlan?: Record<string, unknown>;
	readonly toiletItems?: readonly unknown[];
	readonly note?: unknown;
	readonly tagsIds?: readonly unknown[];
	readonly [field: string]: unknown;
}
