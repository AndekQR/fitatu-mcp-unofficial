import { expect } from "vitest";
import type { DayPlan } from "../../../src/api/dayPlan/DayPlan.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";

export function findMealItem(dayPlan: DayPlan, mealKey: string, itemId: string): DayPlanItem | null {
	const normalizedMealKey = normalizeMealKey(mealKey);
	const meal = dayPlan.meals.find((candidate) => candidate.mealKey === normalizedMealKey);
	return meal?.items.find((item) => item.itemId === itemId) ?? null;
}

export function expectMealItem(dayPlan: DayPlan, mealKey: string, itemId: string): DayPlanItem {
	const item = findMealItem(dayPlan, mealKey, itemId);
	expect(item, `Expected item ${itemId} in ${mealKey} on ${dayPlan.date}`).not.toBeNull();
	return item as DayPlanItem;
}

export function expectNoMealItem(dayPlan: DayPlan, mealKey: string, itemId: string): void {
	expect(findMealItem(dayPlan, mealKey, itemId), `Expected item ${itemId} to be absent from ${mealKey}`).toBeNull();
}

function normalizeMealKey(value: string): string {
	return value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}
