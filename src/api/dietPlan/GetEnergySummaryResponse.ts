export interface GetEnergySummaryResponse {
	readonly targets: Record<string, number | null>;
	readonly measures: Record<string, number | null>;
}
