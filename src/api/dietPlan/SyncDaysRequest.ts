export interface SyncDaysRequest {
	readonly userId: string;
	readonly daysPayload: Record<string, unknown>;
}
