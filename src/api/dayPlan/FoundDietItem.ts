import { ScalarUtils } from "../../shared/ScalarUtils.ts";
import { FoodType } from "./FoodType.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import { MealItemOperationSummary } from "./MealItemOperationSummary.ts";
import type { MealItemKind } from "./RemoveMealItemOptions.ts";

export class FoundDietItem {
	public readonly mealKey: string;
	public readonly item: Record<string, unknown>;
	public readonly items: Record<string, unknown>[];
	public readonly index: number;

	public constructor(
		mealKey: string,
		item: Record<string, unknown>,
		items: Record<string, unknown>[],
		index: number,
	) {
		this.mealKey = mealKey;
		this.item = item;
		this.items = items;
		this.index = index;
	}

	public resolveKind(): Exclude<MealItemKind, "auto"> {
		const foodType = FoodType.fromUpstream(this.item.foodType, "PRODUCT");
		const source = String(this.item.source ?? "")
			.trim()
			.toUpperCase();
		const hasProductId = this.item.productId !== null && this.item.productId !== undefined;
		const quantity =
			typeof this.item.measureQuantity === "number"
				? this.item.measureQuantity
				: Number(this.item.measureQuantity ?? 0);

		if (foodType === "PRODUCT" || hasProductId) {
			return "normal_item";
		}
		if (foodType === "CUSTOM_ITEM") {
			return source === "API" && Number.isFinite(quantity) && quantity <= 2
				? "custom_recipe_item"
				: "custom_add_item";
		}

		return "normal_item";
	}

	public createDeletedMarker(): Record<string, unknown> {
		const marker: Record<string, unknown> = {
			planDayDietItemId: this.item.planDayDietItemId,
			foodType: this.item.foodType ?? "CUSTOM_ITEM",
			measureId: this.item.measureId ?? 1,
			measureQuantity: this.item.measureQuantity ?? 1,
			source: this.item.source ?? "API",
			deletedAt: nowTimestamp(),
			updatedAt: nowTimestamp(),
		};
		const foodType = String(marker.foodType ?? "")
			.trim()
			.toUpperCase();

		if (foodType === "CUSTOM_ITEM") {
			marker.name = this.item.name ?? "x";
			marker.energy = this.item.energy ?? 0;
			marker.protein = this.item.protein ?? 0;
			marker.fat = this.item.fat ?? 0;
			marker.carbohydrate = this.item.carbohydrate ?? 0;
		} else if (this.item.productId !== undefined && this.item.productId !== null) {
			marker.productId = this.item.productId;
		}

		if (this.item.recipeId !== undefined && this.item.recipeId !== null) {
			marker.recipeId = this.item.recipeId;
		}

		return marker;
	}

	public toOperationSummary(index: number, itemId: string): MealItemOperationSummary {
		return new MealItemOperationSummary(
			index,
			itemId,
			ScalarUtils.stringOrFiniteNumberOrNull(this.item.productId),
			ScalarUtils.stringOrFiniteNumberOrNull(this.item.recipeId),
			typeof this.item.foodType === "string" ? this.item.foodType : "UNKNOWN",
			this.mealKey,
		);
	}
}
