import type { RecipeSearchScope } from "./RecipeSearchScope.ts";

export class RecipeSearchOptions {
	declare public readonly query?: string;
	declare public readonly scope?: RecipeSearchScope;
	declare public readonly page?: number;
	declare public readonly limit?: number;
	declare public readonly includeDetails?: boolean;
}
