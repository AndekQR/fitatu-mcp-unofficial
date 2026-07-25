import { DateUtils } from "../../shared/DateUtils.ts";
import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { ResponseUtils } from "../../shared/ResponseUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FoodType, type FoodTypeName } from "../dayPlan/FoodType.ts";
import { createFitatuApiErrorDetails, getFitatuApiErrors } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import type { FoodSearchClientOptions } from "./FoodSearchClientOptions.ts";
import { FoodSearchError } from "./FoodSearchError.ts";
import type { FoodMeasure } from "./FoodMeasure.ts";
import type { FoodNutrition } from "./FoodNutrition.ts";
import type { FoodSearchItem } from "./FoodSearchItem.ts";
import type { FoodSearchOptions } from "./FoodSearchOptions.ts";
import type { FoodSearchQueryResult } from "./FoodSearchQueryResult.ts";
import type { FoodSearchResult } from "./FoodSearchResult.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";
import type { NestedFirstValue } from "./NestedFirstValue.ts";
import type { NormalizedFoodSearchItem } from "./NormalizedFoodSearchItem.ts";
import type { NormalizedFoodSearchOptions } from "./NormalizedFoodSearchOptions.ts";

const DEFAULT_ACCEPT_HEADER = "application/json";
const DEFAULT_LOCALE = "pl_PL";
const DEFAULT_LIMIT = 3;
const DEFAULT_DETAILS_LIMIT = 3;

export class FoodSearchClient extends FitatuApiClientBase {
	public constructor(options: FoodSearchClientOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });

		super({
			...options,
			authClient,
			userClient,
		});
	}

	public async search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		const normalized = normalizeOptions(options);
		const userId = normalized.includeUserFood
			? StringUtils.parseNonEmptyString(await this.getContextUserId(), "Fitatu user id is required")
			: undefined;
		const results: FoodSearchQueryResult[] = [];

		for (const query of normalized.queries) {
			results.push(await this.searchOne(query, normalized, userId));
		}

		const items = this.toOutputItems(results);
		const warnings = results.flatMap((result) => result.warnings);
		const warningDetails = results.flatMap((result) => result.warningDetails);
		const searchAttemptCount = results.reduce((sum, result) => sum + result.searchAttemptCount, 0);
		const searchSuccessCount = results.reduce((sum, result) => sum + result.searchSuccessCount, 0);

		if (searchAttemptCount > 0 && searchSuccessCount === 0) {
			const fitatuApiErrors = warningDetails.flatMap((warning) => [
				...(warning.fitatuApiErrors ?? []),
				...(warning.fitatuApiError ? [warning.fitatuApiError] : []),
			]);
			throw new FoodSearchError("All Fitatu food search requests failed", {
				statusCode: fitatuApiErrors[0]?.statusCode,
				fitatuApiErrors,
			});
		}

		return {
			date: normalized.date,
			queries: normalized.queries,
			queryCount: normalized.queries.length,
			count: items.length,
			items,
			warnings,
			warningDetails,
		};
	}

	public async getAvailableMeasureIds(foodId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>> {
		const normalizedFoodId = StringUtils.parseStringOrSafeInteger(foodId, "foodId is required");
		const details = await this.getFoodDetails(String(normalizedFoodId), foodType);
		return new Set(
			normalizeMeasures(details).flatMap((measure) => (measure.measureId === null ? [] : [measure.measureId])),
		);
	}

	private async searchOne(
		query: string,
		options: NormalizedFoodSearchOptions,
		userId: string | undefined,
	): Promise<FoodSearchQueryResult> {
		const warnings: string[] = [];
		const warningDetails: FoodSearchWarningDetail[] = [];
		const items: NormalizedFoodSearchItem[] = [];
		let searchAttemptCount = 0;
		let searchSuccessCount = 0;

		if (options.includePublicFood) {
			searchAttemptCount += 1;
			let rows: readonly Record<string, unknown>[];
			try {
				rows = await this.fetchSearchRows({
					path: "/search/new/food",
					query: {
						phrase: query,
						page: 1,
						locale: options.locale,
						limit: options.limit,
						accessType: ["FREE", "PREMIUM"],
					},
					failureMessage: "Fitatu public food search request failed",
				});
				searchSuccessCount += 1;
			} catch (error) {
				if (!(error instanceof FoodSearchError)) {
					throw error;
				}
				const warning = `public search failed for query='${query}': ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { query, source: "public" }));
				rows = [];
			}
			items.push(...this.normalizeRows(rows, "public"));
		}

		if (options.includeUserFood) {
			searchAttemptCount += 1;
			const normalizedUserId = StringUtils.parseNonEmptyString(userId, "Fitatu user id is required");
			let rows: readonly Record<string, unknown>[];
			try {
				rows = await this.fetchSearchRows({
					path: `/search/food/user/${encodeURIComponent(normalizedUserId)}`,
					query: {
						date: options.date,
						phrase: query,
						page: 1,
						limit: options.limit,
					},
					failureMessage: "Fitatu user food search request failed",
				});
				searchSuccessCount += 1;
			} catch (error) {
				if (!(error instanceof FoodSearchError)) {
					throw error;
				}
				const warning = `user search failed for query='${query}': ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { query, source: "user" }));
				rows = [];
			}
			items.push(...this.normalizeRows(rows, "user"));
		}

		let scoredItems = deduplicateItems(items).map((item) => ({
			...item,
			matchScore: matchScore(query, item),
		}));

		const hadCandidates = scoredItems.length > 0;
		scoredItems = scoredItems.filter((item) => item.matchScore > 0);
		if (hadCandidates && scoredItems.length === 0) {
			warnings.push("low_confidence_results");
		}

		if (options.includeDetails && options.detailsLimit > 0) {
			scoredItems = await this.withDetails(scoredItems, options.detailsLimit, warnings, warningDetails);
		}

		return {
			query,
			items: scoredItems,
			warnings,
			warningDetails,
			searchAttemptCount,
			searchSuccessCount,
		};
	}

	private async fetchSearchRows(options: {
		readonly path: string;
		readonly query: Record<string, string | number | readonly string[]>;
		readonly failureMessage: string;
	}): Promise<readonly Record<string, unknown>[]> {
		return this.fetchRowsFromFirstSuccessfulVariant([
			{
				path: options.path,
				headers: { accept: this.V3_ACCEPT_HEADER },
				query: options.query,
				failureMessage: options.failureMessage,
			},
			{
				path: options.path,
				headers: { accept: DEFAULT_ACCEPT_HEADER },
				query: options.query,
				failureMessage: options.failureMessage,
			},
		]);
	}

	private async fetchRowsFromFirstSuccessfulVariant(
		variants: readonly {
			readonly path: string;
			readonly headers: Record<string, string>;
			readonly query?: Record<string, string | number | readonly string[]>;
			readonly failureMessage: string;
		}[],
	): Promise<readonly Record<string, unknown>[]> {
		const fitatuApiErrors = [];

		for (const variant of variants) {
			const response = await this.fetchFitatuApi({
				method: "GET",
				path: variant.path,
				query: variant.query,
				headers: variant.headers,
			});

			if (response.ok) {
				return extractRows(await response.json());
			}

			fitatuApiErrors.push(await createFitatuApiErrorDetails(response, { method: "GET", path: variant.path }));
		}

		throw new FoodSearchError(variants[0]?.failureMessage ?? "Fitatu food search request failed", {
			statusCode: fitatuApiErrors.at(-1)?.statusCode,
			fitatuApiErrors,
		});
	}

	private async withDetails(
		items: readonly NormalizedFoodSearchItem[],
		limit: number,
		warnings: string[],
		warningDetails: FoodSearchWarningDetail[],
	): Promise<NormalizedFoodSearchItem[]> {
		const detailed: NormalizedFoodSearchItem[] = [];

		for (const [index, item] of items.entries()) {
			if (index >= limit) {
				detailed.push(item);
				continue;
			}

			let details: Record<string, unknown>;
			try {
				details = await this.getFoodDetails(
					item.foodId,
					item.foodType?.trim().toUpperCase() === "RECIPE" ? "RECIPE" : "PRODUCT",
				);
			} catch (error) {
				if (!(error instanceof FoodSearchError)) {
					throw error;
				}
				const warning = `${item.source} details failed for foodId=${item.foodId}: ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { source: item.source, foodId: item.foodId }));
				detailed.push(item);
				continue;
			}
			detailed.push(mergeDetails(item, details));
		}

		return detailed;
	}

	private async getFoodDetails(
		foodId: string,
		foodType: "PRODUCT" | "RECIPE" | "CUSTOM_ITEM",
	): Promise<Record<string, unknown>> {
		const encodedFoodId = encodeURIComponent(foodId);
		const paths =
			foodType === "RECIPE"
				? [`/recipes/${encodedFoodId}`]
				: [`/products/${encodedFoodId}`, `/v2/products/${encodedFoodId}`, `/v3/products/${encodedFoodId}`];
		const fitatuApiErrors = [];

		for (const path of paths) {
			const response = await this.fetchFitatuApi({
				method: "GET",
				path,
				headers: { accept: DEFAULT_ACCEPT_HEADER },
			});

			if (response.ok) {
				return ResponseUtils.parseJsonObject(response, "Fitatu response was not a valid JSON object");
			}

			fitatuApiErrors.push(await createFitatuApiErrorDetails(response, { method: "GET", path }));
		}

		throw new FoodSearchError("Fitatu product details request failed", {
			statusCode: fitatuApiErrors.at(-1)?.statusCode,
			fitatuApiErrors,
		});
	}

	private normalizeRows(
		rows: readonly Record<string, unknown>[],
		source: FoodSearchSource,
	): NormalizedFoodSearchItem[] {
		const items: NormalizedFoodSearchItem[] = [];

		for (const row of rows) {
			const foodId = StringUtils.stringOrNull(firstValue(row, "foodId", "id", "productId"));
			if (!foodId) {
				continue;
			}

			const measure = recordOrUndefined(row.measure);
			const measureEnergy = NumberUtils.parseOptionalFiniteNumber(
				firstValue(row, "measureEnergy", { record: measure, keys: ["measureEnergy", "energy"] }),
			);

			items.push({
				source,
				foodId,
				foodType: FoodType.fromUpstream(firstValue(row, "type", "foodType"), "PRODUCT"),
				name: StringUtils.stringOrNull(row.name),
				brand: StringUtils.stringOrNull(firstValue(row, "brand", "producer")),
				measureId: StringUtils.stringOrNull(
					firstValue(row, "measureId", "defaultMeasureId", {
						record: measure,
						keys: ["measureId", "defaultMeasureId", "id"],
					}),
				),
				measureName: StringUtils.stringOrNull(
					firstValue(row, "measureName", {
						record: measure,
						keys: ["measureName", "name"],
					}),
				),
				measureQuantity: NumberUtils.parseOptionalFiniteNumber(
					firstValue(row, "measureQuantity", "quantity", {
						record: measure,
						keys: ["measureQuantity", "quantity"],
					}),
				),
				weightG: NumberUtils.parseOptionalFiniteNumber(
					firstValue(row, "measureWeight", {
						record: measure,
						keys: ["measureWeight", "weight", "capacity"],
					}),
				),
				kcal: measureEnergy,
				nutritionPer100g: nutritionFromRecord(row),
				nutritionPerDefaultMeasure: nutrition({
					energyKcal: measureEnergy,
				}),
				verified: booleanOrNull(row.verified),
				photoUrl: photoUrlOrNull(row.photo) ?? photoUrlOrNull(row.mainPhoto),
				matchScore: 0,
				measures: [],
			});
		}

		return items;
	}

	private toOutputItems(results: readonly FoodSearchQueryResult[]): FoodSearchItem[] {
		const output: FoodSearchItem[] = [];

		for (const [queryIndex, result] of results.entries()) {
			for (const item of result.items) {
				output.push({
					index: output.length,
					queryIndex,
					query: result.query,
					source: item.source,
					foodId: item.foodId,
					productId: item.foodId,
					foodType: item.foodType,
					name: item.name,
					displayName: displayName(item),
					brand: item.brand,
					measureId: item.measureId,
					measureName: item.measureName,
					measureQuantity: item.measureQuantity,
					weightG: item.weightG,
					kcal: item.kcal,
					nutritionPer100g: item.nutritionPer100g,
					nutritionPerDefaultMeasure: item.nutritionPerDefaultMeasure,
					verified: item.verified,
					photoUrl: item.photoUrl,
					matchScore: item.matchScore,
					measures: item.measures,
				});
			}
		}

		return output;
	}
}

function normalizeOptions(options: FoodSearchOptions): NormalizedFoodSearchOptions {
	const queries = normalizeQueries(options.queries);
	const limit = NumberUtils.parseIntegerInRange(
		options.limit ?? DEFAULT_LIMIT,
		1,
		50,
		"limit must be between 1 and 50",
	);
	const detailsLimit = NumberUtils.parseIntegerInRange(
		options.detailsLimit ?? DEFAULT_DETAILS_LIMIT,
		0,
		50,
		"detailsLimit must be between 0 and 50",
	);
	const includeUserFood = options.includeUserFood ?? true;
	const includePublicFood = options.includePublicFood ?? true;

	if (!includeUserFood && !includePublicFood) {
		throw new FoodSearchError("At least one food source must be enabled");
	}

	return {
		queries,
		date: DateUtils.validateIsoDate(options.date ?? DateUtils.toLocalDateString(), {
			calendarErrorMessage: "date must use YYYY-MM-DD format",
		}),
		locale: StringUtils.parseNonEmptyString(options.locale ?? DEFAULT_LOCALE, "locale is required"),
		limit,
		includeUserFood,
		includePublicFood,
		includeDetails: options.includeDetails ?? false,
		detailsLimit,
	};
}

function normalizeQueries(queries: readonly string[] | undefined): readonly string[] {
	if (!queries) {
		throw new FoodSearchError("queries is required");
	}
	if (queries.length === 0) {
		throw new FoodSearchError("queries must not be empty");
	}

	return queries.map((value) =>
		StringUtils.parseNonEmptyString(value, "queries must not contain empty values is required"),
	);
}

function extractRows(data: unknown): readonly Record<string, unknown>[] {
	if (Array.isArray(data)) {
		return data.filter(ObjectUtils.isRecord);
	}
	if (!ObjectUtils.isRecord(data)) {
		throw new FoodSearchError("Fitatu search response was not a valid JSON object or array");
	}

	const nested = recordOrUndefined(data.data);
	const rows = listOrUndefined(data.items) ?? listOrUndefined(data.results) ?? listOrUndefined(nested?.items);
	return rows?.filter(ObjectUtils.isRecord) ?? [];
}

function mergeDetails(item: NormalizedFoodSearchItem, details: Record<string, unknown>): NormalizedFoodSearchItem {
	const detailsNutrition = nutritionFromRecord(details);
	const measures = normalizeMeasures(details);

	return {
		...item,
		nutritionPer100g: mergeNutrition(item.nutritionPer100g, detailsNutrition),
		verified: item.verified ?? booleanOrNull(details.verified),
		photoUrl: item.photoUrl ?? photoUrlOrNull(details.photo) ?? photoUrlOrNull(details.mainPhoto),
		measures,
	};
}

function normalizeMeasures(details: Record<string, unknown>): readonly FoodMeasure[] {
	const measures: FoodMeasure[] = [];
	const directMeasureId = StringUtils.stringOrNull(firstValue(details, "measureId", "defaultMeasureId"));
	if (directMeasureId) {
		measures.push({
			measureId: directMeasureId,
			measureName: StringUtils.stringOrNull(firstValue(details, "measureName")),
			weightG: NumberUtils.parseOptionalFiniteNumber(firstValue(details, "measureWeight", "weight", "capacity")),
			unit: StringUtils.stringOrNull(firstValue(details, "unit", "unitKey")),
			energyKcal: NumberUtils.parseOptionalFiniteNumber(firstValue(details, "measureEnergy", "energy")),
		});
	}

	for (const raw of listOrUndefined(details.measures) ?? []) {
		const measure = recordOrUndefined(raw);
		if (!measure) {
			continue;
		}
		measures.push({
			measureId: StringUtils.stringOrNull(firstValue(measure, "id", "measureId", "key")),
			measureName: StringUtils.stringOrNull(firstValue(measure, "name", "measureName")),
			weightG: NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "weight", "weightPerUnit", "capacity")),
			unit: StringUtils.stringOrNull(firstValue(measure, "unit", "unitKey")),
			energyKcal: NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "energy", "energyPerUnit")),
		});
	}

	for (const raw of listOrUndefined(details.simpleMeasures) ?? []) {
		const measure = recordOrUndefined(raw);
		if (!measure) {
			continue;
		}
		measures.push({
			measureId: StringUtils.stringOrNull(firstValue(measure, "measureId", "id", "key")),
			measureName: StringUtils.stringOrNull(firstValue(measure, "name", "measureName")),
			weightG: NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "weight", "capacity")),
			unit: StringUtils.stringOrNull(firstValue(measure, "unit", "unitKey")),
			energyKcal: NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "energy", "energyPerUnit")),
		});
	}

	const initial = recordOrUndefined(details.initialMeasure);
	if (initial) {
		measures.push({
			measureId: StringUtils.stringOrNull(firstValue(initial, "key", "id", "measureId")),
			measureName: StringUtils.stringOrNull(firstValue(initial, "name", "measureName")),
			weightG: NumberUtils.parseOptionalFiniteNumber(firstValue(initial, "weight", "capacity")),
			unit: StringUtils.stringOrNull(firstValue(initial, "unit", "unitKey")),
			energyKcal: NumberUtils.parseOptionalFiniteNumber(firstValue(initial, "energy", "energyPerUnit")),
		});
	}

	return deduplicateMeasures(measures);
}

function deduplicateItems(items: readonly NormalizedFoodSearchItem[]): NormalizedFoodSearchItem[] {
	const seen = new Set<string>();
	const deduplicated: NormalizedFoodSearchItem[] = [];

	for (const item of items) {
		const key = `${item.source}:${item.foodId}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduplicated.push(item);
	}

	return deduplicated;
}

function deduplicateMeasures(measures: readonly FoodMeasure[]): readonly FoodMeasure[] {
	const seen = new Set<string>();
	const deduplicated: FoodMeasure[] = [];

	for (const measure of measures) {
		const key = `${measure.measureId ?? ""}:${measure.measureName ?? ""}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduplicated.push(measure);
	}

	return deduplicated;
}

function nutritionFromRecord(record: Record<string, unknown>): FoodNutrition {
	return nutrition({
		energyKcal: NumberUtils.parseOptionalFiniteNumber(record.energy),
		proteinG: NumberUtils.parseOptionalFiniteNumber(record.protein),
		fatG: NumberUtils.parseOptionalFiniteNumber(record.fat),
		carbsG: NumberUtils.parseOptionalFiniteNumber(record.carbohydrate),
		fiberG: NumberUtils.parseOptionalFiniteNumber(record.fiber),
		sugarsG: NumberUtils.parseOptionalFiniteNumber(record.sugars),
		saltG: NumberUtils.parseOptionalFiniteNumber(record.salt),
		saturatedFatG: NumberUtils.parseOptionalFiniteNumber(record.saturatedFat),
	});
}

function nutrition(values: Partial<FoodNutrition> = {}): FoodNutrition {
	return {
		energyKcal: values.energyKcal ?? null,
		proteinG: values.proteinG ?? null,
		fatG: values.fatG ?? null,
		carbsG: values.carbsG ?? null,
		fiberG: values.fiberG ?? null,
		sugarsG: values.sugarsG ?? null,
		saltG: values.saltG ?? null,
		saturatedFatG: values.saturatedFatG ?? null,
	};
}

function mergeNutrition(primary: FoodNutrition, fallback: FoodNutrition): FoodNutrition {
	return {
		energyKcal: primary.energyKcal ?? fallback.energyKcal,
		proteinG: primary.proteinG ?? fallback.proteinG,
		fatG: primary.fatG ?? fallback.fatG,
		carbsG: primary.carbsG ?? fallback.carbsG,
		fiberG: primary.fiberG ?? fallback.fiberG,
		sugarsG: primary.sugarsG ?? fallback.sugarsG,
		saltG: primary.saltG ?? fallback.saltG,
		saturatedFatG: primary.saturatedFatG ?? fallback.saturatedFatG,
	};
}

function matchScore(query: string, item: NormalizedFoodSearchItem): number {
	const queryTokens = tokens(query);
	if (queryTokens.size === 0) {
		return 0;
	}

	const candidateTokens = tokens([item.name, item.brand].filter(isNonEmptyString).join(" "));
	if (candidateTokens.size === 0) {
		return 0;
	}

	let overlap = 0;
	for (const token of queryTokens) {
		if (candidateTokens.has(token)) {
			overlap += 1;
		}
	}

	return Math.round((overlap / queryTokens.size) * 10000) / 10000;
}

function tokens(value: string): Set<string> {
	return new Set(
		value
			.normalize("NFKD")
			.toLowerCase()
			.replace(/\p{Diacritic}/gu, "")
			.replace(/[łđðþæœø]/g, (character) => LATIN_CHARACTER_FOLD[character] ?? character)
			.match(/[a-z0-9]+/g)
			?.filter((token) => token.length > 1) ?? [],
	);
}

const LATIN_CHARACTER_FOLD: Readonly<Record<string, string>> = {
	ł: "l",
	đ: "d",
	ð: "d",
	þ: "th",
	æ: "ae",
	œ: "oe",
	ø: "o",
};

function displayName(item: NormalizedFoodSearchItem): string {
	const parts: string[] = [];
	const name = item.name ?? item.foodId;
	const measure = formatMeasure(item);
	if (measure) {
		parts.push(measure);
	}
	if (item.weightG !== null && !measureAlreadyDescribesWeight(item)) {
		parts.push(`${formatNumber(item.weightG)} g`);
	}
	if (item.kcal !== null) {
		parts.push(`${formatNumber(item.kcal)} kcal`);
	} else if (item.nutritionPer100g.energyKcal !== null) {
		parts.push(`${formatNumber(item.nutritionPer100g.energyKcal)} kcal`);
	}

	return parts.length > 0 ? `${name} - ${parts.join(", ")}` : name;
}

function formatMeasure(item: NormalizedFoodSearchItem): string | undefined {
	if (!item.measureName) {
		return undefined;
	}
	if (item.measureQuantity === null) {
		return item.measureName;
	}

	return `${formatNumber(item.measureQuantity)} ${item.measureName}`;
}

function measureAlreadyDescribesWeight(item: NormalizedFoodSearchItem): boolean {
	if (item.measureQuantity === null || item.weightG === null || item.measureName === null) {
		return false;
	}

	return (
		["g", "gram", "grams", "gramy"].includes(item.measureName.toLowerCase()) &&
		item.measureQuantity === item.weightG
	);
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(value);
}

function firstValue(record: Record<string, unknown>, ...keys: readonly (string | NestedFirstValue)[]): unknown {
	for (const key of keys) {
		if (typeof key === "string") {
			if (record[key] !== undefined && record[key] !== null) {
				return record[key];
			}
			continue;
		}

		if (!key.record) {
			continue;
		}
		for (const nestedKey of key.keys) {
			if (key.record[nestedKey] !== undefined && key.record[nestedKey] !== null) {
				return key.record[nestedKey];
			}
		}
	}

	return undefined;
}

function booleanOrNull(value: unknown): boolean | null {
	if (typeof value === "boolean") {
		return value;
	}

	return null;
}

function photoUrlOrNull(value: unknown): string | null {
	if (typeof value === "string") {
		return value.trim() || null;
	}
	if (ObjectUtils.isRecord(value)) {
		return StringUtils.stringOrNull(value.url) ?? StringUtils.stringOrNull(value.path);
	}

	return null;
}

function listOrUndefined(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
	return ObjectUtils.isRecord(value) ? value : undefined;
}

function isNonEmptyString(value: string | null): value is string {
	return typeof value === "string" && value.length > 0;
}

function toWarningDetail(
	message: string,
	error: unknown,
	context: {
		readonly query?: string;
		readonly source?: FoodSearchSource;
		readonly foodId?: string;
	},
): FoodSearchWarningDetail {
	const fitatuApiErrors = getFitatuApiErrors(error);
	return {
		message,
		errorName: error instanceof Error ? error.name : "UnknownError",
		...context,
		...(fitatuApiErrors.length === 1 ? { fitatuApiError: fitatuApiErrors[0] } : {}),
		...(fitatuApiErrors.length > 1 ? { fitatuApiErrors } : {}),
	};
}

function safeWarningMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : "unknown error";
	const fitatuApiErrors = getFitatuApiErrors(error);
	const firstFitatuApiError = fitatuApiErrors[0];
	if (!firstFitatuApiError) {
		return message;
	}

	const statusText = firstFitatuApiError.statusText ? ` ${firstFitatuApiError.statusText}` : "";
	const upstreamMessage = firstFitatuApiError.upstreamMessage ? `: ${firstFitatuApiError.upstreamMessage}` : "";
	return `${message} (HTTP ${firstFitatuApiError.statusCode}${statusText}${upstreamMessage})`;
}
