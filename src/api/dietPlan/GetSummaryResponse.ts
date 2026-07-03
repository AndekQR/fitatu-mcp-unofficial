export interface SummaryMeasure {
	readonly current: number | null;
	readonly min: number | null;
	readonly max: number | null;
	readonly eaten: number | null;
}

export type GetSummaryResponse = Record<string, SummaryMeasure>;
