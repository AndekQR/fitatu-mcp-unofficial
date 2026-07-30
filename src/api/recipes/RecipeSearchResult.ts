import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { RecipeSearchItem } from "./RecipeSearchItem.ts";
import type { RecipeSearchScope } from "./RecipeSearchScope.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";
import type { RecipeSearchWarning } from "./RecipeSearchWarning.ts";

export class RecipeSearchResult<
	TItem extends RecipeSearchItem = RecipeSearchItem,
	TWarning extends RecipeSearchWarning = RecipeSearchWarning,
> {
	public readonly query: string;
	public readonly scope: RecipeSearchScope;
	public readonly page: number;
	public readonly limit: number;
	public readonly count: number;
	public readonly items: readonly TItem[];
	public readonly warnings: readonly TWarning[];

	public constructor(
		query: string,
		scope: RecipeSearchScope,
		page: number,
		limit: number,
		items: readonly TItem[],
		warnings: readonly TWarning[],
	) {
		this.query = query;
		this.scope = scope;
		this.page = page;
		this.limit = limit;
		this.count = items.length;
		this.items = items;
		this.warnings = warnings;
	}

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
			throw new FitatuResponseDecodeError("Fitatu recipe search response was not a valid JSON object or array");
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
		throw new FitatuResponseDecodeError("Fitatu recipe search response did not contain an items array");
	}
}
