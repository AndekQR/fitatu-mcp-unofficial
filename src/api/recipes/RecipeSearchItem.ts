import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";

export class RecipeSearchItem {
	declare public readonly recipeId: string;
	declare public readonly name: string;
	declare public readonly source: RecipeSearchSource;
	declare public readonly energyKcal: number | null;

	public static fromApiResponse(
		response: Record<string, unknown>,
		source: RecipeSearchSource,
	): RecipeSearchItem | null {
		const type = StringUtils.stringOrNull(response.type) ?? StringUtils.stringOrNull(response.foodType);
		if (type?.toUpperCase() !== "RECIPE") {
			return null;
		}
		const recipeId =
			StringUtils.stringOrNull(response.recipeId) ??
			StringUtils.stringOrNull(response.foodId) ??
			StringUtils.stringOrNull(response.id);
		const name = StringUtils.stringOrNull(response.name);
		if (!recipeId || !name) {
			return null;
		}
		return {
			recipeId,
			name,
			source,
			energyKcal: NumberUtils.parseOptionalFiniteNumber(response.energy),
		};
	}
}
