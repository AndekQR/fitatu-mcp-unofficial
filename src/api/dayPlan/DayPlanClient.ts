import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { DayPlan } from "./DayPlan.ts";
import type { DayPlanClientOptions } from "./DayPlanClientOptions.ts";
import type {
	AddMealItemsOptions,
	GetDayPlanOptions,
	MoveMealItemOptions,
	RemoveMealItemOptions,
	UpdateMealItemOptions,
} from "./DayPlanClientTypes.ts";
import { normalizeDate, normalizeUserId } from "./DayPlanValidators.ts";
import { DayPlanSyncService } from "./DayPlanSyncService.ts";
import { MealItemMutationService } from "./MealItemMutationService.ts";
import type { MealItemMutationResult } from "./MealItemMutation.ts";

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
		const date = normalizeDate(options.date);
		const userId = normalizeUserId(await this.getContextUserId(options.userId));

		return DayPlan.fromApiResponse({
			data: await this.dayPlanSyncService.getDayPlanData({ date, userId, withRating: options.withRating }),
			date,
			userId,
		});
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		const userId = normalizeUserId(await this.getContextUserId(options.userId));
		return this.mealItemMutationService.addMealItems({ ...options, userId });
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		const userId = normalizeUserId(await this.getContextUserId(options.userId));
		return this.mealItemMutationService.updateMealItem({ ...options, userId });
	}

	public async removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult> {
		const userId = normalizeUserId(await this.getContextUserId(options.userId));
		return this.mealItemMutationService.removeMealItem({ ...options, userId });
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		const userId = normalizeUserId(await this.getContextUserId(options.userId));
		return this.mealItemMutationService.moveMealItem({ ...options, userId });
	}
}
