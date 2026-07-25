import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { RecipeError } from "./RecipeError.ts";
import { RecipeSearchItem } from "./RecipeSearchItem.ts";
import type { RecipeSearchScope } from "./RecipeSearchScope.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";

export interface RecipeSearchWarning {
	readonly code: "RECIPE_SOURCE_UNAVAILABLE";
	readonly source: RecipeSearchSource;
	readonly message: string;
}

export class RecipeSearchResult {
	declare public readonly query: string;
	declare public readonly scope: RecipeSearchScope;
	declare public readonly page: number;
	declare public readonly limit: number;
	declare public readonly count: number;
	declare public readonly items: readonly RecipeSearchItem[];
	declare public readonly warnings: readonly RecipeSearchWarning[];

	public static extractItems(response: unknown, source: RecipeSearchSource): readonly RecipeSearchItem[] {
		return RecipeSearchResult.extractRows(response).flatMap((row) => {
			const item = RecipeSearchItem.fromApiResponse(row, source);
			return item ? [item] : [];
		});
	}

	public static deduplicateItems(items: readonly RecipeSearchItem[]): readonly RecipeSearchItem[] {
		const seen = new Set<string>();
		return items.filter((item) => {
			if (seen.has(item.recipeId)) {
				return false;
			}
			seen.add(item.recipeId);
			return true;
		});
	}

	private static extractRows(response: unknown): readonly Record<string, unknown>[] {
		if (Array.isArray(response)) {
			return response.filter(ObjectUtils.isRecord);
		}
		if (!ObjectUtils.isRecord(response)) {
			throw new RecipeError("Fitatu recipe search response was not a valid JSON object or array");
		}

		const nested = ObjectUtils.isRecord(response.data) ? response.data : undefined;
		if (Array.isArray(response.items)) {
			return response.items.filter(ObjectUtils.isRecord);
		}
		if (Array.isArray(response.results)) {
			return response.results.filter(ObjectUtils.isRecord);
		}
		if (Array.isArray(nested?.items)) {
			return nested.items.filter(ObjectUtils.isRecord);
		}
		throw new RecipeError("Fitatu recipe search response did not contain an items array");
	}
}
