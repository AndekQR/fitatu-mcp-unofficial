import type { RecipeSearchScope } from "./RecipeSearchScope.ts";

export class RecipeSearchOptions {
	public readonly query?: string;
	public readonly scope?: RecipeSearchScope;
	public readonly page?: number;
	public readonly limit?: number;
	public readonly includeDetails?: boolean;

	public constructor(
		query?: string,
		scope?: RecipeSearchScope,
		page?: number,
		limit?: number,
		includeDetails?: boolean,
	) {
		this.query = query;
		this.scope = scope;
		this.page = page;
		this.limit = limit;
		this.includeDetails = includeDetails;
	}
}
