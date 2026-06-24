import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import type { FoodMeasure } from "../../../src/api/foodSearch/FoodMeasure.ts";
import type { FoodSearchItem } from "../../../src/api/foodSearch/FoodSearchItem.ts";

export interface SelectedMeasure {
	readonly measureId: string;
	readonly measureName: string | null;
	readonly weightG: number | null;
	readonly unit: string | null;
}

export interface SelectedProduct {
	readonly productId: string;
	readonly foodType: string | undefined;
	readonly displayName: string;
	readonly measure: SelectedMeasure;
	readonly availableMeasures: readonly SelectedMeasure[];
}

export interface SelectedProductsByMeasure {
	readonly fallbackProduct: SelectedProduct;
	readonly gramProduct: SelectedProduct;
	readonly packageProduct: SelectedProduct;
}

const SEARCH_TERMS = ["banan", "jogurt", "chleb", "mleko", "ryz", "jablko"];

export async function selectProductsByMeasure(options: {
	readonly foodSearchClient: FoodSearchClient;
	readonly date: string;
}): Promise<SelectedProductsByMeasure> {
	const attempts: string[] = [];
	const available: string[] = [];
	let fallbackProduct: SelectedProduct | null = null;
	let gramProduct: SelectedProduct | null = null;
	let packageProduct: SelectedProduct | null = null;

	for (const query of SEARCH_TERMS) {
		attempts.push(query);
		const result = await options.foodSearchClient.search({
			queries: [query],
			date: options.date,
			locale: "pl_PL",
			limit: 10,
			includePublicFood: true,
			includeUserFood: false,
			includeDetails: true,
			detailsLimit: 8,
		});

		for (const item of result.items) {
			const measures = uniqueMeasures(
				[toMeasure(item), ...item.measures.map(normalizeMeasure)].filter(isMeasure),
			);
			fallbackProduct ??= toSelectedProduct(item, firstMeasureWithId(measures, item.measureId), measures);
			gramProduct ??= toSelectedProduct(item, measures.find(isGramLikeMeasure) ?? null, measures);
			packageProduct ??= toSelectedProduct(
				item,
				measures.find((measure) => !isGramLikeMeasure(measure) && hasUsablePackageShape(measure)) ?? null,
				measures,
			);

			if (fallbackProduct && gramProduct && packageProduct) {
				return {
					fallbackProduct,
					gramProduct,
					packageProduct,
				};
			}

			available.push(formatAvailableMeasures(item));
		}
	}

	throw new Error(
		[
			"Could not find Fitatu products for fallback, gram-like, and package-like measures.",
			`Searched terms: ${attempts.join(", ")}`,
			`Available measures: ${available.filter(Boolean).join(" | ")}`,
		].join("\n"),
	);
}

export async function searchMultipleQueries(options: {
	readonly foodSearchClient: FoodSearchClient;
	readonly date: string;
}): Promise<void> {
	const result = await options.foodSearchClient.search({
		queries: ["banan", "jogurt"],
		date: options.date,
		locale: "pl_PL",
		limit: 5,
		includePublicFood: true,
		includeUserFood: true,
		includeDetails: true,
		detailsLimit: 2,
	});

	if (result.queryCount !== 2 || result.items.length === 0) {
		throw new Error(`Expected multi-query search to return results, got queryCount=${result.queryCount}`);
	}
}

function toSelectedProduct(
	item: FoodSearchItem,
	measure: SelectedMeasure | null,
	measures: readonly SelectedMeasure[],
): SelectedProduct | null {
	if (!measure) {
		return null;
	}

	return {
		productId: item.productId,
		foodType: item.foodType ?? undefined,
		displayName: item.displayName,
		measure,
		availableMeasures: measures,
	};
}

function toMeasure(item: FoodSearchItem): SelectedMeasure | null {
	if (!item.measureId) {
		return null;
	}

	return {
		measureId: item.measureId,
		measureName: item.measureName,
		weightG: item.weightG,
		unit: null,
	};
}

function normalizeMeasure(measure: FoodMeasure): SelectedMeasure | null {
	if (!measure.measureId) {
		return null;
	}

	return {
		measureId: measure.measureId,
		measureName: measure.measureName,
		weightG: measure.weightG,
		unit: measure.unit,
	};
}

function isMeasure(value: SelectedMeasure | null): value is SelectedMeasure {
	return Boolean(value?.measureId);
}

function uniqueMeasures(measures: readonly SelectedMeasure[]): readonly SelectedMeasure[] {
	const seen = new Set<string>();
	const unique: SelectedMeasure[] = [];

	for (const measure of measures) {
		if (seen.has(measure.measureId)) {
			continue;
		}
		seen.add(measure.measureId);
		unique.push(measure);
	}

	return unique;
}

function firstMeasureWithId(measures: readonly SelectedMeasure[], preferredId: string | null): SelectedMeasure | null {
	return measures.find((measure) => measure.measureId === preferredId) ?? measures[0] ?? null;
}

function isGramLikeMeasure(measure: SelectedMeasure): boolean {
	const label = `${measure.measureName ?? ""} ${measure.unit ?? ""}`.toLowerCase();
	return /\b(g|gram|gramy|gramow|grams)\b/.test(label) || measure.weightG === 1 || measure.weightG === 100;
}

function hasUsablePackageShape(measure: SelectedMeasure): boolean {
	const label = `${measure.measureName ?? ""} ${measure.unit ?? ""}`.toLowerCase();
	return (
		/\b(opak|szt|porcja|plaster|lyzka|szklanka|kubek|unit|piece|serving)\b/.test(label) ||
		(measure.weightG !== null && measure.weightG > 1)
	);
}

function formatAvailableMeasures(item: FoodSearchItem): string {
	const measures = uniqueMeasures([toMeasure(item), ...item.measures.map(normalizeMeasure)].filter(isMeasure));
	const formattedMeasures = measures
		.map(
			(measure) =>
				`${measure.measureId}:${measure.measureName ?? "unknown"}:${measure.unit ?? "unit?"}:${measure.weightG ?? "g?"}`,
		)
		.join(",");
	return `${item.displayName}=[${formattedMeasures}]`;
}
