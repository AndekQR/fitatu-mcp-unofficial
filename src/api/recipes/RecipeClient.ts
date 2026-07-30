import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { BoundedPoller } from "../../shared/BoundedPoller.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuRequestFailure } from "../fitatuApiClientBase/FitatuClientFailure.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS, type FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { RecipeCreateResult } from "./RecipeCreateResult.ts";
import { RecipeDeleteResult } from "./RecipeDeleteResult.ts";
import { RecipeDetails } from "./RecipeDetails.ts";
import type { RecipeReplacementInput } from "./RecipeReplacementInput.ts";
import { RecipeReplaceResult } from "./RecipeReplaceResult.ts";
import type { RecipeSearchItem } from "./RecipeSearchItem.ts";
import { RecipeSearchOptions } from "./RecipeSearchOptions.ts";
import { RecipeSearchResult } from "./RecipeSearchResult.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";
import { RecipeSearchWarning } from "./RecipeSearchWarning.ts";
import { RecipeWriteInput } from "./RecipeWriteInput.ts";

const JSON_ACCEPT_HEADER = "application/json";
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const READ_AFTER_WRITE_ATTEMPTS = 5;

export class RecipeClient extends FitatuApiClientBase {
	private readonly deletionConfirmationPoller = new BoundedPoller();

	public constructor(options: FitatuApiClientBaseOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });
		super({ ...options, authClient, userClient });
	}

	public async getRecipe(recipeId: string | number): Promise<RecipeDetails> {
		const normalizedRecipeId = StringUtils.stringOrNull(recipeId);
		if (normalizedRecipeId === null) {
			throw invalidRecipeRequest(FITATU_CLIENT_OPERATIONS.recipesGet, "recipeId is required");
		}
		const userId = StringUtils.firstNonEmptyString(await this.getContextUserId());
		if (!userId) {
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.recipesGet,
				message: "Fitatu user id is required",
			});
		}
		const path = `/recipes-and-user-action/${encodeURIComponent(normalizedRecipeId)}/${encodeURIComponent(userId)}`;
		return this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.recipesGet,
			method: "GET",
			path,
			endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
			failureMessage: "Fitatu recipe details request failed",
			invalidResponseMessage: "Fitatu recipe response was invalid",
			decoder: decodeRecipeDetails,
		});
	}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeCreateResult> {
		const body = createRecipePayload(input, null, FITATU_CLIENT_OPERATIONS.recipesCreate);
		const created = await this.performRecipeWriteCallout({
			operation: FITATU_CLIENT_OPERATIONS.recipesCreate,
			method: "POST",
			path: "/recipes",
			body,
			failureMessage: "Fitatu recipe creation failed",
		});
		const recipeId = created.id;

		return new RecipeCreateResult(recipeId, await this.getRecipeAfterWrite(recipeId));
	}

	public async replaceRecipe(recipeId: string | number, input: RecipeReplacementInput): Promise<RecipeReplaceResult> {
		const previousRecipeId = StringUtils.stringOrNull(recipeId);
		if (previousRecipeId === null) {
			throw invalidRecipeRequest(FITATU_CLIENT_OPERATIONS.recipesReplace, "recipeId is required");
		}
		const body = createRecipePayload(input, input.categories, FITATU_CLIENT_OPERATIONS.recipesReplace);
		const created = await this.performRecipeWriteCallout({
			operation: FITATU_CLIENT_OPERATIONS.recipesReplace,
			method: "PUT",
			path: `/recipes/${encodeURIComponent(previousRecipeId)}`,
			body,
			failureMessage: "Fitatu recipe update failed",
		});
		const nextRecipeId = created.id;

		return new RecipeReplaceResult(
			new RecipeCreateResult(nextRecipeId, await this.getRecipeAfterWrite(nextRecipeId)),
			previousRecipeId,
			nextRecipeId !== previousRecipeId,
		);
	}

	public async deleteRecipe(recipeId: string | number): Promise<RecipeDeleteResult> {
		const normalizedRecipeId = StringUtils.stringOrNull(recipeId);
		if (normalizedRecipeId === null) {
			throw invalidRecipeRequest(FITATU_CLIENT_OPERATIONS.recipesDelete, "recipeId is required");
		}
		const path = `/recipes/${encodeURIComponent(normalizedRecipeId)}`;
		await this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.recipesDelete,
			method: "DELETE",
			path,
			endpointTemplate: "/recipes/:recipeId",
			failureMessage: "Fitatu recipe deletion failed",
			invalidResponseMessage: "Fitatu recipe deletion response was invalid",
			headers: { accept: JSON_ACCEPT_HEADER },
			decoder: () => null,
		});
		await this.confirmRecipeDeletion(normalizedRecipeId);
		return new RecipeDeleteResult(normalizedRecipeId);
	}

	public async searchRecipes(options: RecipeSearchOptions = new RecipeSearchOptions()): Promise<RecipeSearchResult> {
		if (options.query !== undefined && typeof options.query !== "string") {
			throw invalidRecipeRequest(FITATU_CLIENT_OPERATIONS.recipesSearch, "query must be a string");
		}
		const query = options.query?.trim() ?? "";
		const scope = options.scope ?? "mine";
		if (!["mine", "public", "all"].includes(scope)) {
			throw invalidRecipeRequest(FITATU_CLIENT_OPERATIONS.recipesSearch, "scope must be mine, public, or all");
		}
		let page: number;
		let limit: number;
		try {
			page = NumberUtils.parsePositiveInteger(options.page ?? 1, "page must be a positive integer");
			limit = NumberUtils.parseIntegerInRange(
				options.limit ?? DEFAULT_SEARCH_LIMIT,
				1,
				MAX_SEARCH_LIMIT,
				`limit must be between 1 and ${MAX_SEARCH_LIMIT}`,
			);
		} catch (error) {
			if (!(error instanceof ValidationError)) {
				throw error;
			}
			throw invalidRecipeRequest(FITATU_CLIENT_OPERATIONS.recipesSearch, error.message);
		}
		const matchLocale = query ? normalizeCaseLocale(await this.getContextSearchLocale()) : undefined;
		const searched =
			scope === "all"
				? await this.searchCombinedRecipePage({ query, page, limit, matchLocale })
				: query
					? {
							items: await this.searchFilteredRecipePage({
								query,
								source: scope,
								page,
								limit,
								matchLocale,
							}),
							warnings: [],
						}
					: {
							items: RecipeSearchResult.deduplicateItems(
								await this.fetchRecipeSourcePage({ query, source: scope, page, limit }),
							).slice(0, limit),
							warnings: [],
						};
		return new RecipeSearchResult(query, scope, page, limit, searched.items, searched.warnings);
	}

	private async searchFilteredRecipePage(options: {
		readonly query: string;
		readonly source: RecipeSearchSource;
		readonly page: number;
		readonly limit: number;
		readonly matchLocale?: string;
	}): Promise<readonly RecipeSearchItem[]> {
		const requestedEnd = options.page * options.limit;
		const matches = await this.collectMatchingRecipeItems({
			...options,
			count: requestedEnd,
		});
		const offset = (options.page - 1) * options.limit;
		return matches.slice(offset, offset + options.limit);
	}

	private async collectMatchingRecipeItems(options: {
		readonly query: string;
		readonly source: RecipeSearchSource;
		readonly limit: number;
		readonly count: number;
		readonly matchLocale?: string;
	}): Promise<readonly RecipeSearchItem[]> {
		const matches: RecipeSearchItem[] = [];
		const seen = new Set<string>();

		for (let sourcePage = 1; matches.length < options.count; sourcePage += 1) {
			const sourceItems = await this.fetchRecipeSourcePage({ ...options, page: sourcePage });
			let discoveredItem = false;

			for (const item of sourceItems) {
				if (seen.has(item.recipeId)) {
					continue;
				}
				seen.add(item.recipeId);
				discoveredItem = true;
				if (recipeNameIncludes(item.name, options.query, options.matchLocale)) {
					matches.push(item);
				}
			}

			if (sourceItems.length < options.limit || !discoveredItem) {
				break;
			}
		}

		return matches;
	}

	private async fetchRecipeSourcePage(options: {
		readonly query: string;
		readonly source: RecipeSearchSource;
		readonly page: number;
		readonly limit: number;
	}): Promise<readonly RecipeSearchItem[]> {
		const contextUserId =
			options.source === "mine" ? StringUtils.firstNonEmptyString(await this.getContextUserId()) : undefined;
		if (options.source === "mine" && !contextUserId) {
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.recipesSearch,
				message: "Fitatu user id is required",
			});
		}
		const path =
			options.source === "mine"
				? `/search/food/user/${encodeURIComponent(contextUserId ?? "")}`
				: "/search/new/food";
		return this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.recipesSearch,
			method: "GET",
			path,
			endpointTemplate: options.source === "mine" ? "/search/food/user/:userId" : "/search/new/food",
			failureMessage: "Fitatu recipe search failed",
			invalidResponseMessage: "Fitatu recipe search response was invalid",
			headers: { accept: this.V3_ACCEPT_HEADER },
			query: {
				phrase: options.query,
				page: options.page,
				limit: options.limit,
				...(options.source === "public"
					? {
							locale: await this.getContextSearchLocale(),
							accessType: ["FREE", "PREMIUM"],
						}
					: {}),
			},
			decoder: (data) => decodeRecipeSearch(data, options.source),
		});
	}

	private async searchCombinedRecipePage(options: {
		readonly query: string;
		readonly page: number;
		readonly limit: number;
		readonly matchLocale?: string;
	}): Promise<{
		readonly items: readonly RecipeSearchItem[];
		readonly warnings: RecipeSearchResult["warnings"];
	}> {
		const requestedEnd = options.page * options.limit;
		let mineResult: PromiseSettledResult<readonly RecipeSearchItem[]>;
		let publicResult: PromiseSettledResult<readonly RecipeSearchItem[]>;
		if (options.query) {
			mineResult = await settle(
				this.collectMatchingRecipeItems({ ...options, source: "mine", count: requestedEnd }),
			);
			publicResult = await settle(
				this.collectMatchingRecipeItems({ ...options, source: "public", count: requestedEnd }),
			);
		} else {
			const mine: RecipeSearchItem[] = [];
			const publicItems: RecipeSearchItem[] = [];
			let mineFailure: unknown;
			let publicFailure: unknown;
			for (let sourcePage = 1; sourcePage <= options.page; sourcePage += 1) {
				if (mineFailure === undefined) {
					try {
						mine.push(
							...(await this.fetchRecipeSourcePage({
								...options,
								source: "mine",
								page: sourcePage,
							})),
						);
					} catch (error) {
						mineFailure = error;
					}
				}
				if (publicFailure === undefined) {
					try {
						publicItems.push(
							...(await this.fetchRecipeSourcePage({
								...options,
								source: "public",
								page: sourcePage,
							})),
						);
					} catch (error) {
						publicFailure = error;
					}
				}
			}
			mineResult =
				mineFailure === undefined
					? { status: "fulfilled", value: mine }
					: { status: "rejected", reason: mineFailure };
			publicResult =
				publicFailure === undefined
					? { status: "fulfilled", value: publicItems }
					: { status: "rejected", reason: publicFailure };
		}
		const mineError = rejectedClientError(mineResult);
		const publicError = rejectedClientError(publicResult);
		if (mineResult.status === "rejected" && publicResult.status === "rejected") {
			throw publicError?.withAttempts(
				[...(mineError ? toRecipeRequestFailures(mineError) : []), ...(publicError.attempts ?? [])],
				"All Fitatu recipe search requests failed",
			);
		}
		const mine = mineResult.status === "fulfilled" ? mineResult.value : [];
		const publicItems = publicResult.status === "fulfilled" ? publicResult.value : [];
		const warnings = [
			...(mineError ? [sourceWarning("mine", mineError)] : []),
			...(publicError ? [sourceWarning("public", publicError)] : []),
		];
		const combined = RecipeSearchResult.deduplicateItems(interleave(mine, publicItems));
		const offset = (options.page - 1) * options.limit;

		if (options.query) {
			return { items: combined.slice(offset, offset + options.limit), warnings };
		}
		return { items: combined.slice(offset, offset + options.limit), warnings };
	}

	private async performRecipeWriteCallout(options: {
		readonly operation: FitatuClientOperation;
		readonly method: "POST" | "PUT";
		readonly path: string;
		readonly body: Record<string, unknown>;
		readonly failureMessage: string;
	}): Promise<Record<string, unknown> & { readonly id: string }> {
		return this.performCallout({
			operation: options.operation,
			method: options.method,
			path: options.path,
			endpointTemplate: options.method === "POST" ? "/recipes" : "/recipes/:recipeId",
			failureMessage: options.failureMessage,
			invalidResponseMessage: "Fitatu recipe response was invalid",
			headers: {
				accept: JSON_ACCEPT_HEADER,
				"content-type": "application/json;charset=UTF-8",
			},
			body: JSON.stringify(options.body),
			decoder: decodeRecipeWriteResponse,
		});
	}

	private async getRecipeAfterWrite(recipeId: string): Promise<RecipeDetails> {
		return FitatuFallbackRunner.run(
			Array.from({ length: READ_AFTER_WRITE_ATTEMPTS }),
			() => this.getRecipe(recipeId),
			(error) => error.failure.kind === "http" && error.failure.statusCode === 404,
			() => wait(250),
		);
	}

	private async confirmRecipeDeletion(recipeId: string): Promise<void> {
		await this.deletionConfirmationPoller.pollUntil(
			async () => {
				try {
					const recipe = await this.getRecipe(recipeId);
					return recipe.deleted;
				} catch (error) {
					if (isMissingRecipeError(error)) {
						return true;
					}
					throw error;
				}
			},
			() =>
				FitatuClientError.invalidResponse({
					operation: FITATU_CLIENT_OPERATIONS.recipesDelete,
					message: "Fitatu accepted the recipe deletion but it could not be confirmed within 60 seconds",
					method: "GET",
					endpointTemplate: "/recipes-and-user-action/:recipeId/:userId",
				}),
		);
	}
}

function sourceWarning(
	source: RecipeSearchSource,
	clientError: FitatuClientError,
): RecipeSearchResult["warnings"][number] {
	return new RecipeSearchWarning(
		"RECIPE_SOURCE_UNAVAILABLE",
		source,
		`${source} recipe catalog was unavailable; results are partial.`,
		clientError,
	);
}

async function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
	try {
		return { status: "fulfilled", value: await promise };
	} catch (reason) {
		return { status: "rejected", reason };
	}
}

function interleave(
	first: readonly RecipeSearchItem[],
	second: readonly RecipeSearchItem[],
): readonly RecipeSearchItem[] {
	const result: RecipeSearchItem[] = [];
	const length = Math.max(first.length, second.length);
	for (let index = 0; index < length; index += 1) {
		const firstItem = first[index];
		const secondItem = second[index];
		if (firstItem) {
			result.push(firstItem);
		}
		if (secondItem) {
			result.push(secondItem);
		}
	}
	return result;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

function recipeNameIncludes(name: string, query: string, locale?: string): boolean {
	return query === "" || name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale));
}

function normalizeCaseLocale(locale: string): string | undefined {
	try {
		return Intl.getCanonicalLocales(locale.replaceAll("_", "-"))[0];
	} catch {
		return undefined;
	}
}

function decodeJsonObject(data: unknown): Record<string, unknown> {
	if (!ObjectUtils.isRecord(data)) {
		throw new FitatuResponseDecodeError("Fitatu recipe response was not a valid JSON object");
	}
	return data;
}

function decodeRecipeDetails(data: unknown): RecipeDetails {
	try {
		return RecipeDetails.fromApiResponse(decodeJsonObject(data));
	} catch (error) {
		if (error instanceof FitatuResponseDecodeError) throw error;
		if (!(error instanceof ValidationError)) throw error;
		throw new FitatuResponseDecodeError(error.message);
	}
}

function decodeRecipeWriteResponse(data: unknown): Record<string, unknown> & { readonly id: string } {
	const response = decodeJsonObject(data);
	const id = StringUtils.stringOrNull(response.id);
	if (!id) {
		throw new FitatuResponseDecodeError("Fitatu recipe response id is required");
	}
	return { ...response, id };
}

function decodeRecipeSearch(data: unknown, source: RecipeSearchSource): readonly RecipeSearchItem[] {
	try {
		return RecipeSearchResult.extractItems(data, source);
	} catch (error) {
		if (error instanceof FitatuResponseDecodeError) throw error;
		if (!(error instanceof ValidationError)) throw error;
		throw new FitatuResponseDecodeError(error.message);
	}
}

function invalidRecipeRequest(operation: FitatuClientOperation, message: string): FitatuClientError {
	return FitatuClientError.invalidRequest({ operation, message });
}

function isMissingRecipeError(error: unknown): boolean {
	return (
		error instanceof FitatuClientError &&
		error.failure.kind === "http" &&
		(error.failure.statusCode === 404 || error.failure.statusCode === 410)
	);
}

function rejectedClientError<T>(result: PromiseSettledResult<T>): FitatuClientError | undefined {
	if (result.status === "fulfilled") return undefined;
	if (result.reason instanceof FitatuClientError) return result.reason;
	throw result.reason;
}

function toRecipeRequestFailures(error: FitatuClientError): FitatuRequestFailure[] {
	const failures = [...error.attempts];
	if (
		error.failure.kind === "http" ||
		error.failure.kind === "transport" ||
		error.failure.kind === "invalidResponse"
	) {
		failures.push(error.failure);
	}
	return failures;
}

function createRecipePayload(
	input: RecipeWriteInput,
	categories: RecipeReplacementInput["categories"],
	operation: FitatuClientOperation,
): Record<string, unknown> {
	try {
		return RecipeWriteInput.toRecipePayload(input, categories);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw invalidRecipeRequest(operation, error.message);
	}
}
