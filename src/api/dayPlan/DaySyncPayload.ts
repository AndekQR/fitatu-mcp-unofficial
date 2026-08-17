export class DaySyncPayload {
	public readonly planDayRevisions: unknown[];
	/**
	 * Deliberately absent from the payload. Meal mutations never touch
	 * activities, and echoing server-owned activity entries (e.g. Garmin
	 * imports) back at POST /diet-plan/:userId/days makes the upstream
	 * respond 500 for any day that has them - which turned every
	 * activity-bearing day read-only for this client. A missing key means
	 * "leave activities untouched" upstream (verified: they survive a sync
	 * that omits the key).
	 */
	public readonly activities?: undefined;
	public readonly dietPlan: Record<string, unknown>;
	public readonly toilet: unknown[];
	public readonly water: Record<string, unknown>;
	public readonly note: unknown;
	public readonly tagsIds: unknown[];

	public constructor(options: {
		readonly planDayRevisions: unknown[];
		readonly dietPlan: Record<string, unknown>;
		readonly toilet: unknown[];
		readonly water: Record<string, unknown>;
		readonly note: unknown;
		readonly tagsIds: unknown[];
	}) {
		this.planDayRevisions = options.planDayRevisions;
		this.dietPlan = options.dietPlan;
		this.toilet = options.toilet;
		this.water = options.water;
		this.note = options.note;
		this.tagsIds = options.tagsIds;
	}
}
