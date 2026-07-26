export class DaySyncPayload {
	public readonly dietPlan: Record<string, unknown>;
	public readonly toiletItems: unknown[];
	public readonly note: unknown;
	public readonly tagsIds: unknown[];

	public constructor(options: {
		readonly dietPlan: Record<string, unknown>;
		readonly toiletItems: unknown[];
		readonly note: unknown;
		readonly tagsIds: unknown[];
	}) {
		this.dietPlan = options.dietPlan;
		this.toiletItems = options.toiletItems;
		this.note = options.note;
		this.tagsIds = options.tagsIds;
	}
}
