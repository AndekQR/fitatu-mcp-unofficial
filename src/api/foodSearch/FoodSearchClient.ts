import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuAuthError } from "../auth/FitatuAuthError.ts";
import { createFitatuApiErrorDetails, getFitatuApiErrors } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import type { FoodSearchClientOptions } from "./FoodSearchClientOptions.ts";
import { FoodSearchError } from "./FoodSearchError.ts";
import type {
	FoodMeasure,
	FoodNutrition,
	FoodSearchItem,
	FoodSearchOptions,
	FoodSearchResult,
	FoodSearchSource,
	FoodSearchWarningDetail,
} from "./FoodSearchResult.ts";

const V3_ACCEPT_HEADER = "application/json; version=v3";
const DEFAULT_ACCEPT_HEADER = "application/json";
const DEFAULT_LOCALE = "pl_PL";
const DEFAULT_LIMIT = 10;
const DEFAULT_DETAILS_LIMIT = 3;

interface NormalizedSearchItem {
	readonly source: FoodSearchSource;
	readonly foodId: string;
	readonly foodType: string | null;
	readonly name: string | null;
	readonly brand: string | null;
	readonly measureId: string | null;
	readonly measureName: string | null;
	readonly measureQuantity: number | null;
	readonly weightG: number | null;
	readonly kcal: number | null;
	readonly nutritionPer100g: FoodNutrition;
	readonly nutritionPerDefaultMeasure: FoodNutrition;
	readonly verified: boolean | null;
	readonly photoUrl: string | null;
	readonly matchScore: number;
	readonly measures: readonly FoodMeasure[];
}

interface SearchQueryResult {
	readonly query: string;
	readonly items: readonly NormalizedSearchItem[];
	readonly warnings: readonly string[];
	readonly warningDetails: readonly FoodSearchWarningDetail[];
	readonly searchAttemptCount: number;
	readonly searchSuccessCount: number;
}

interface NormalizedOptions {
	readonly queries: readonly string[];
	readonly date: string;
	readonly locale: string;
	readonly limit: number;
	readonly includeUserFood: boolean;
	readonly includePublicFood: boolean;
	readonly includeDetails: boolean;
	readonly detailsLimit: number;
}

export class FoodSearchClient extends FitatuApiClientBase {
	private static instance: FoodSearchClient | undefined;

	private constructor(options: FoodSearchClientOptions = {}) {
		const sessionProvider = options.sessionProvider ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ sessionProvider });

		super({
			...options,
			sessionProvider,
			currentUserProvider: options.currentUserProvider ?? userClient,
		});
	}

	public static getInstance(options: FoodSearchClientOptions = {}): FoodSearchClient {
		if (!FoodSearchClient.instance) {
			FoodSearchClient.instance = new FoodSearchClient(options);
		}

		return FoodSearchClient.instance;
	}

	public async search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		const normalized = normalizeOptions(options);
		const userId = normalized.includeUserFood
			? normalizeRequiredText(await this.getContextUserId(), "Fitatu user id")
			: undefined;
		const results: SearchQueryResult[] = [];

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
			status: "ok",
			date: normalized.date,
			queries: normalized.queries,
			queryCount: normalized.queries.length,
			count: items.length,
			items,
			warnings,
			warningDetails,
			message: "Food search completed",
		};
	}

	private async searchOne(
		query: string,
		options: NormalizedOptions,
		userId: string | undefined,
	): Promise<SearchQueryResult> {
		const warnings: string[] = [];
		const warningDetails: FoodSearchWarningDetail[] = [];
		const items: NormalizedSearchItem[] = [];
		let searchAttemptCount = 0;
		let searchSuccessCount = 0;

		if (options.includePublicFood) {
			searchAttemptCount += 1;
			try {
				const rows = await this.fetchSearchRows({
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
				items.push(...this.normalizeRows(rows, "public"));
			} catch (error) {
				if (error instanceof FitatuAuthError) {
					throw error;
				}
				const warning = `public search failed for query='${query}': ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { query, source: "public" }));
			}
		}

		if (options.includeUserFood) {
			searchAttemptCount += 1;
			try {
				const rows = await this.fetchSearchRows({
					path: `/search/food/user/${encodeURIComponent(normalizeRequiredText(userId, "Fitatu user id"))}`,
					query: {
						date: options.date,
						phrase: query,
						page: 1,
						limit: options.limit,
					},
					failureMessage: "Fitatu user food search request failed",
				});
				searchSuccessCount += 1;
				items.push(...this.normalizeRows(rows, "user"));
			} catch (error) {
				if (error instanceof FitatuAuthError) {
					throw error;
				}
				const warning = `user search failed for query='${query}': ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { query, source: "user" }));
			}
		}

		let scoredItems = deduplicateItems(items).map((item) => ({
			...item,
			matchScore: matchScore(query, item),
		}));

		if (scoredItems.length > 0 && Math.max(...scoredItems.map((item) => item.matchScore)) <= 0) {
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
				headers: { accept: V3_ACCEPT_HEADER },
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
				return extractRows(await parseJson(response));
			}

			fitatuApiErrors.push(
				await createFitatuApiErrorDetails(response, { method: "GET", path: variant.path }),
			);
		}

		throw new FoodSearchError(variants[0]?.failureMessage ?? "Fitatu food search request failed", {
			statusCode: fitatuApiErrors.at(-1)?.statusCode,
			fitatuApiErrors,
		});
	}

	private async withDetails(
		items: readonly NormalizedSearchItem[],
		limit: number,
		warnings: string[],
		warningDetails: FoodSearchWarningDetail[],
	): Promise<NormalizedSearchItem[]> {
		const detailed: NormalizedSearchItem[] = [];

		for (const [index, item] of items.entries()) {
			if (index >= limit) {
				detailed.push(item);
				continue;
			}

			try {
				const details = await this.getProductDetails(item.foodId);
				detailed.push(mergeDetails(item, details));
			} catch (error) {
				if (error instanceof FitatuAuthError) {
					throw error;
				}
				const warning = `${item.source} details failed for foodId=${item.foodId}: ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { source: item.source, foodId: item.foodId }));
				detailed.push(item);
			}
		}

		return detailed;
	}

	private async getProductDetails(productId: string): Promise<Record<string, unknown>> {
		const encodedProductId = encodeURIComponent(productId);
		const paths = [
			`/products/${encodedProductId}`,
			`/v2/products/${encodedProductId}`,
			`/v3/products/${encodedProductId}`,
			`/recipes/${encodedProductId}`,
		];
		const fitatuApiErrors = [];

		for (const path of paths) {
			const response = await this.fetchFitatuApi({
				method: "GET",
				path,
				headers: { accept: DEFAULT_ACCEPT_HEADER },
			});

			if (response.ok) {
				return parseJsonObject(response);
			}

			fitatuApiErrors.push(await createFitatuApiErrorDetails(response, { method: "GET", path }));
		}

		throw new FoodSearchError("Fitatu product details request failed", {
			statusCode: fitatuApiErrors.at(-1)?.statusCode,
			fitatuApiErrors,
		});
	}

	private normalizeRows(rows: readonly Record<string, unknown>[], source: FoodSearchSource): NormalizedSearchItem[] {
		const items: NormalizedSearchItem[] = [];

		for (const row of rows) {
			const foodId = stringOrNull(firstValue(row, "foodId", "id", "productId"));
			if (!foodId) {
				continue;
			}

			const measure = recordOrUndefined(row.measure);
			const measureEnergy = numberOrNull(
				firstValue(row, "measureEnergy", { record: measure, keys: ["measureEnergy", "energy"] }),
			);

			items.push({
				source,
				foodId,
				foodType: stringOrNull(firstValue(row, "type", "foodType")),
				name: stringOrNull(row.name),
				brand: stringOrNull(firstValue(row, "brand", "producer")),
				measureId: stringOrNull(
					firstValue(row, "measureId", "defaultMeasureId", {
						record: measure,
						keys: ["measureId", "defaultMeasureId", "id"],
					}),
				),
				measureName: stringOrNull(
					firstValue(row, "measureName", {
						record: measure,
						keys: ["measureName", "name"],
					}),
				),
				measureQuantity: numberOrNull(
					firstValue(row, "measureQuantity", "quantity", {
						record: measure,
						keys: ["measureQuantity", "quantity"],
					}),
				),
				weightG: numberOrNull(
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

	private toOutputItems(results: readonly SearchQueryResult[]): FoodSearchItem[] {
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

function normalizeOptions(options: FoodSearchOptions): NormalizedOptions {
	const queries = normalizeQueries(options.queries);
	const limit = options.limit ?? DEFAULT_LIMIT;
	const detailsLimit = options.detailsLimit ?? DEFAULT_DETAILS_LIMIT;
	const includeUserFood = options.includeUserFood ?? true;
	const includePublicFood = options.includePublicFood ?? true;

	if (limit < 1 || limit > 50) {
		throw new FoodSearchError("limit must be between 1 and 50");
	}
	if (detailsLimit < 0 || detailsLimit > 50) {
		throw new FoodSearchError("detailsLimit must be between 0 and 50");
	}
	if (!includeUserFood && !includePublicFood) {
		throw new FoodSearchError("At least one food source must be enabled");
	}

	return {
		queries,
		date: normalizeDate(options.date ?? localDateString()),
		locale: normalizeRequiredText(options.locale ?? DEFAULT_LOCALE, "locale"),
		limit,
		includeUserFood,
		includePublicFood,
		includeDetails: options.includeDetails ?? true,
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

	return queries.map((value) => normalizeRequiredText(value, "queries must not contain empty values"));
}

function normalizeDate(value: string): string {
	const date = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new FoodSearchError("date must use YYYY-MM-DD format");
	}

	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new FoodSearchError("date must use YYYY-MM-DD format");
	}

	return date;
}

function localDateString(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function normalizeRequiredText(value: string | undefined, name: string): string {
	const normalized = value?.trim();
	if (!normalized) {
		throw new FoodSearchError(`${name} is required`);
	}

	return normalized;
}

async function parseJsonObject(response: Response): Promise<Record<string, unknown>> {
	const data: unknown = await response.json();
	if (!isRecord(data)) {
		throw new FoodSearchError("Fitatu response was not a valid JSON object");
	}

	return data;
}

async function parseJson(response: Response): Promise<unknown> {
	return response.json();
}

function extractRows(data: unknown): readonly Record<string, unknown>[] {
	if (Array.isArray(data)) {
		return data.filter(isRecord);
	}
	if (!isRecord(data)) {
		throw new FoodSearchError("Fitatu search response was not a valid JSON object or array");
	}

	const nested = recordOrUndefined(data.data);
	const rows = listOrUndefined(data.items) ?? listOrUndefined(data.results) ?? listOrUndefined(nested?.items);
	return rows?.filter(isRecord) ?? [];
}

function mergeDetails(item: NormalizedSearchItem, details: Record<string, unknown>): NormalizedSearchItem {
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

	for (const raw of listOrUndefined(details.measures) ?? []) {
		const measure = recordOrUndefined(raw);
		if (!measure) {
			continue;
		}
		measures.push({
			measureId: stringOrNull(firstValue(measure, "id", "measureId", "key")),
			measureName: stringOrNull(firstValue(measure, "name", "measureName")),
			weightG: numberOrNull(firstValue(measure, "weight", "weightPerUnit", "capacity")),
			unit: stringOrNull(firstValue(measure, "unit", "unitKey")),
			energyKcal: numberOrNull(firstValue(measure, "energy", "energyPerUnit")),
		});
	}

	for (const raw of listOrUndefined(details.simpleMeasures) ?? []) {
		const measure = recordOrUndefined(raw);
		if (!measure) {
			continue;
		}
		measures.push({
			measureId: stringOrNull(firstValue(measure, "measureId", "id", "key")),
			measureName: stringOrNull(firstValue(measure, "name", "measureName")),
			weightG: numberOrNull(firstValue(measure, "weight", "capacity")),
			unit: stringOrNull(firstValue(measure, "unit", "unitKey")),
			energyKcal: numberOrNull(firstValue(measure, "energy", "energyPerUnit")),
		});
	}

	const initial = recordOrUndefined(details.initialMeasure);
	if (initial) {
		measures.push({
			measureId: stringOrNull(firstValue(initial, "key", "id", "measureId")),
			measureName: stringOrNull(firstValue(initial, "name", "measureName")),
			weightG: numberOrNull(firstValue(initial, "weight", "capacity")),
			unit: stringOrNull(firstValue(initial, "unit", "unitKey")),
			energyKcal: numberOrNull(firstValue(initial, "energy", "energyPerUnit")),
		});
	}

	return deduplicateMeasures(measures);
}

function deduplicateItems(items: readonly NormalizedSearchItem[]): NormalizedSearchItem[] {
	const seen = new Set<string>();
	const deduplicated: NormalizedSearchItem[] = [];

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
		energyKcal: numberOrNull(record.energy),
		proteinG: numberOrNull(record.protein),
		fatG: numberOrNull(record.fat),
		carbsG: numberOrNull(record.carbohydrate),
		fiberG: numberOrNull(record.fiber),
		sugarsG: numberOrNull(record.sugars),
		saltG: numberOrNull(record.salt),
		saturatedFatG: numberOrNull(record.saturatedFat),
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

function matchScore(query: string, item: NormalizedSearchItem): number {
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
			.match(/[a-z0-9]+/g)
			?.filter((token) => token.length > 1) ?? [],
	);
}

function displayName(item: NormalizedSearchItem): string {
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

function formatMeasure(item: NormalizedSearchItem): string | undefined {
	if (!item.measureName) {
		return undefined;
	}
	if (item.measureQuantity === null) {
		return item.measureName;
	}

	return `${formatNumber(item.measureQuantity)} ${item.measureName}`;
}

function measureAlreadyDescribesWeight(item: NormalizedSearchItem): boolean {
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

type NestedFirstValue = {
	readonly record: Record<string, unknown> | undefined;
	readonly keys: readonly string[];
};

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

function stringOrNull(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return null;
}

function numberOrNull(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
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
	if (isRecord(value)) {
		return stringOrNull(value.url) ?? stringOrNull(value.path);
	}

	return null;
}

function listOrUndefined(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
	return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
