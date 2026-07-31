import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";

export class RecipeSearchItem {
	public readonly recipeId: string;
	public readonly name: string;
	public readonly source: RecipeSearchSource;
	public readonly energyKcal: number | null;

	public constructor(recipeId: string, name: string, source: RecipeSearchSource, energyKcal: number | null) {
		this.recipeId = recipeId;
		this.name = name;
		this.source = source;
		this.energyKcal = energyKcal;
	}

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
		return new RecipeSearchItem(recipeId, name, source, NumberUtils.parseOptionalFiniteNumber(response.energy));
	}
}
