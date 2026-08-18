import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { AddMealItemsOptions } from "./AddMealItemsOptions.ts";
import { DayPlan } from "./DayPlan.ts";
import { DayPlanSyncCoordinator } from "./DayPlanSyncCoordinator.ts";
import { GetDayPlanOptions } from "./GetDayPlanOptions.ts";
import { MealItemMutationCoordinator } from "./MealItemMutationCoordinator.ts";
import type { MealItemMutationResult } from "./MealItemMutationResult.ts";
import { MoveMealItemOptions } from "./MoveMealItemOptions.ts";
import { RemoveMealItemOptions } from "./RemoveMealItemOptions.ts";
import { RemoveMealItemsOptions } from "./RemoveMealItemsOptions.ts";
import { UpdateMealItemOptions } from "./UpdateMealItemOptions.ts";
import { ReplaceMealItemOptions } from "./ReplaceMealItemOptions.ts";

export class DayPlanClient extends FitatuApiClientBase {
	private readonly dayPlanSyncCoordinator: DayPlanSyncCoordinator;
	private readonly mealItemMutationCoordinator: MealItemMutationCoordinator;

	public constructor(options: FitatuApiClientBaseOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });

		super({
			...options,
			authClient,
			userClient,
		});

		this.dayPlanSyncCoordinator = new DayPlanSyncCoordinator({
			...options,
			authClient,
			userClient,
		});
		this.mealItemMutationCoordinator = new MealItemMutationCoordinator(this.dayPlanSyncCoordinator);
	}

	public async getDayPlan(options: GetDayPlanOptions): Promise<DayPlan> {
		const normalizedOptions = GetDayPlanOptions.from(options);
		const date = normalizeDayPlanDate(normalizedOptions.date, FITATU_CLIENT_OPERATIONS.dayPlanGet);
		const userId = await this.getRequiredContextUserId(
			normalizedOptions.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanGet,
		);

		const data = await this.dayPlanSyncCoordinator.getDayPlanData(
			new GetDayPlanOptions(date, userId, normalizedOptions.withRating),
		);
		try {
			return DayPlan.fromApiResponse({ data, date, userId });
		} catch (error) {
			if (!(error instanceof FitatuResponseDecodeError)) {
				throw error;
			}
			throw FitatuClientError.invalidResponse({
				operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
				message: error.message,
				method: "GET",
				endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
				cause: error,
			});
		}
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = AddMealItemsOptions.from(options);
		const userId = await this.getRequiredContextUserId(
			normalizedOptions.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanAddItems,
		);
		return this.mealItemMutationCoordinator.addMealItems(
			new AddMealItemsOptions(normalizedOptions.date, normalizedOptions.mealKey, normalizedOptions.items, userId),
		);
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = UpdateMealItemOptions.from(options);
		const userId = await this.getRequiredContextUserId(
			normalizedOptions.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem,
		);
		return this.mealItemMutationCoordinator.updateMealItem(
			new UpdateMealItemOptions(
				normalizedOptions.date,
				normalizedOptions.mealKey,
				normalizedOptions.itemId,
				normalizedOptions.measureQuantity,
				normalizedOptions.measureId,
				normalizedOptions.eaten,
				userId,
				normalizedOptions.name,
				normalizedOptions.energyKcal,
				normalizedOptions.proteinG,
				normalizedOptions.fatG,
				normalizedOptions.carbohydrateG,
			),
		);
	}

	public async removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = RemoveMealItemOptions.from(options);
		const userId = await this.getRequiredContextUserId(
			normalizedOptions.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem,
		);
		return this.mealItemMutationCoordinator.removeMealItem(
			new RemoveMealItemOptions(
				normalizedOptions.date,
				normalizedOptions.mealKey,
				normalizedOptions.itemId,
				userId,
			),
		);
	}

	public async replaceMealItem(options: ReplaceMealItemOptions): Promise<MealItemMutationResult> {
		const userId = await this.getRequiredContextUserId(
			options.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanReplaceItem,
		);
		return this.mealItemMutationCoordinator.replaceMealItem(
			new ReplaceMealItemOptions(
				options.date,
				options.mealKey,
				options.itemId,
				options.replacement,
				userId,
			),
		);
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = RemoveMealItemsOptions.from(options);
		const userId = await this.getRequiredContextUserId(
			normalizedOptions.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems,
		);
		return this.mealItemMutationCoordinator.removeMealItems(
			new RemoveMealItemsOptions(normalizedOptions.date, normalizedOptions.items, userId),
		);
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = MoveMealItemOptions.from(options);
		const userId = await this.getRequiredContextUserId(
			normalizedOptions.userId,
			FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
		);
		return this.mealItemMutationCoordinator.moveMealItem(
			new MoveMealItemOptions(
				normalizedOptions.fromDate,
				normalizedOptions.fromMealKey,
				normalizedOptions.itemId,
				normalizedOptions.toDate,
				normalizedOptions.toMealKey,
				userId,
			),
		);
	}

	private async getRequiredContextUserId(
		userId: string | undefined,
		operation: (typeof FITATU_CLIENT_OPERATIONS)[keyof typeof FITATU_CLIENT_OPERATIONS],
	): Promise<string> {
		const resolvedUserId = StringUtils.firstNonEmptyString(await this.getContextUserId(userId));
		if (!resolvedUserId) {
			throw FitatuClientError.authentication({
				operation,
				message: "Fitatu user id is required",
			});
		}
		return resolvedUserId;
	}
}

function normalizeDayPlanDate(
	date: string,
	operation: (typeof FITATU_CLIENT_OPERATIONS)[keyof typeof FITATU_CLIENT_OPERATIONS],
): string {
	try {
		return DateUtils.validateIsoDate(date);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw FitatuClientError.invalidRequest({
			operation,
			message: error.message,
		});
	}
}
