import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { AddMealItemsOptions } from "./AddMealItemsOptions.ts";
import { DayPlan } from "./DayPlan.ts";
import type { DayPlanClientOptions } from "./DayPlanClientOptions.ts";
import { DayPlanSyncService } from "./DayPlanSyncService.ts";
import { GetDayPlanOptions } from "./GetDayPlanOptions.ts";
import { MealItemMutationService } from "./MealItemMutationService.ts";
import type { MealItemMutationResult } from "./MealItemMutationResult.ts";
import { MoveMealItemOptions } from "./MoveMealItemOptions.ts";
import { RemoveMealItemOptions } from "./RemoveMealItemOptions.ts";
import { RemoveMealItemsOptions } from "./RemoveMealItemsOptions.ts";
import { UpdateMealItemOptions } from "./UpdateMealItemOptions.ts";

export class DayPlanClient extends FitatuApiClientBase {
	private readonly dayPlanSyncService: DayPlanSyncService;
	private readonly mealItemMutationService: MealItemMutationService;

	public constructor(options: DayPlanClientOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });

		super({
			...options,
			authClient,
			userClient,
		});

		this.dayPlanSyncService = new DayPlanSyncService({
			...options,
			authClient,
			userClient,
		});
		this.mealItemMutationService = new MealItemMutationService(this.dayPlanSyncService);
	}

	public async getDayPlan(options: GetDayPlanOptions): Promise<DayPlan> {
		const normalizedOptions = GetDayPlanOptions.from(options);
		const date = DateUtils.validateIsoDate(normalizedOptions.date);
		const userId = StringUtils.parseNonEmptyString(
			await this.getContextUserId(normalizedOptions.userId),
			"Fitatu user id is required",
		);

		return DayPlan.fromApiResponse({
			data: await this.dayPlanSyncService.getDayPlanData({
				date,
				userId,
				withRating: normalizedOptions.withRating,
			}),
			date,
			userId,
		});
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = AddMealItemsOptions.from(options);
		const userId = StringUtils.parseNonEmptyString(
			await this.getContextUserId(normalizedOptions.userId),
			"Fitatu user id is required",
		);
		return this.mealItemMutationService.addMealItems({ ...normalizedOptions, userId });
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = UpdateMealItemOptions.from(options);
		const userId = StringUtils.parseNonEmptyString(
			await this.getContextUserId(normalizedOptions.userId),
			"Fitatu user id is required",
		);
		return this.mealItemMutationService.updateMealItem({ ...normalizedOptions, userId });
	}

	public async removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = RemoveMealItemOptions.from(options);
		const userId = StringUtils.parseNonEmptyString(
			await this.getContextUserId(normalizedOptions.userId),
			"Fitatu user id is required",
		);
		return this.mealItemMutationService.removeMealItem({ ...normalizedOptions, userId });
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = RemoveMealItemsOptions.from(options);
		const userId = StringUtils.parseNonEmptyString(
			await this.getContextUserId(normalizedOptions.userId),
			"Fitatu user id is required",
		);
		return this.mealItemMutationService.removeMealItems({ ...normalizedOptions, userId });
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		const normalizedOptions = MoveMealItemOptions.from(options);
		const userId = StringUtils.parseNonEmptyString(
			await this.getContextUserId(normalizedOptions.userId),
			"Fitatu user id is required",
		);
		return this.mealItemMutationService.moveMealItem({ ...normalizedOptions, userId });
	}
}
