export class DaySyncPayload {
	public readonly planDayRevisions: unknown[];
	public readonly activities: unknown[];
	public readonly dietPlan: Record<string, unknown>;
	public readonly toilet: unknown[];
	public readonly water: Record<string, unknown>;
	public readonly note: unknown;
	public readonly tagsIds: unknown[];

	public constructor(options: {
		readonly planDayRevisions: unknown[];
		readonly activities: unknown[];
		readonly dietPlan: Record<string, unknown>;
		readonly toilet: unknown[];
		readonly water: Record<string, unknown>;
		readonly note: unknown;
		readonly tagsIds: unknown[];
	}) {
		this.planDayRevisions = options.planDayRevisions;
		this.activities = options.activities;
		this.dietPlan = options.dietPlan;
		this.toilet = options.toilet;
		this.water = options.water;
		this.note = options.note;
		this.tagsIds = options.tagsIds;
	}
}
