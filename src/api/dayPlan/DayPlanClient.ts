import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiRequestOptions } from "../fitatuApiClientBase/FitatuApiRequestOptions.ts";
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
import { DayPlanSyncService, type FitatuApiTransport } from "./DayPlanSyncService.ts";
import { MealItemMutationService } from "./MealItemMutationService.ts";
import type { MealItemMutationResult } from "./MealItemMutation.ts";

export class DayPlanClient extends FitatuApiClientBase {
	private static instance: DayPlanClient | undefined;

	private readonly dayPlanSyncService: DayPlanSyncService;
	private readonly mealItemMutationService: MealItemMutationService;

	private constructor(options: DayPlanClientOptions = {}) {
		const sessionProvider = options.sessionProvider ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ sessionProvider });

		super({
			...options,
			sessionProvider,
			currentUserProvider: options.currentUserProvider ?? userClient,
		});

		const transport: FitatuApiTransport = {
			fetchFitatuApi: (requestOptions: FitatuApiRequestOptions) => this.fetchFitatuApi(requestOptions),
		};
		this.dayPlanSyncService = new DayPlanSyncService(transport);
		this.mealItemMutationService = new MealItemMutationService(this.dayPlanSyncService);
	}

	public static getInstance(options: DayPlanClientOptions = {}): DayPlanClient {
		if (!DayPlanClient.instance) {
			DayPlanClient.instance = new DayPlanClient(options);
		}

		return DayPlanClient.instance;
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
