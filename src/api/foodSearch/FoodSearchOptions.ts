export interface FoodSearchOptions {
	readonly queries: readonly string[];
	readonly date?: string;
	readonly locale?: string;
	readonly limit?: number;
	readonly includeUserFood?: boolean;
	readonly includePublicFood?: boolean;
	readonly includeDetails?: boolean;
	readonly detailsLimit?: number;
}
