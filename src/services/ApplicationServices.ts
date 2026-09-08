import { FitatuAuthClient } from "../api/auth/FitatuAuthClient.ts";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { SummaryClient } from "../api/dietPlan/SummaryClient.ts";
import { FoodSearchClient } from "../api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../api/recipes/RecipeClient.ts";
import { FitatuUserClient } from "../api/users/FitatuUserClient.ts";
import { UserSettingsClient } from "../api/users/UserSettingsClient.ts";
import { MeasurementsClient } from "../api/users/MeasurementsClient.ts";
import { BodyMeasurementService } from "./bodyMeasurements/BodyMeasurementService.ts";
import { CurrentUserService } from "./currentUser/CurrentUserService.ts";
import { DayPlanQueryService } from "./dayPlan/DayPlanQueryService.ts";
import { DietSummaryService } from "./dietSummary/DietSummaryService.ts";
import { MealItemMutationService } from "./dayPlan/MealItemMutationService.ts";
import { FoodSearchService } from "./foodSearch/FoodSearchService.ts";
import { RecipeService } from "./recipes/RecipeService.ts";
import { getFitatuMobileClientProfile } from "../config.ts";
import { BoundedPoller } from "../shared/BoundedPoller.ts";
import { MealItemMutationConfirmer } from "./dayPlan/MealItemMutationConfirmer.ts";
import { RecipeMutationConfirmer } from "./recipes/RecipeMutationConfirmer.ts";
import { UserSettingsService } from "./userSettings/UserSettingsService.ts";

/**
 * Process-wide composition root. MCP tools receive services from this class
 * rather than constructing or importing HTTP clients themselves.
 */
export class ApplicationServices {
	public readonly currentUserService: CurrentUserService;
	public readonly bodyMeasurementService: BodyMeasurementService;
	public readonly dayPlanQueryService: DayPlanQueryService;
	public readonly dietSummaryService: DietSummaryService;
	public readonly mealItemMutationService: MealItemMutationService;
	public readonly foodSearchService: FoodSearchService;
	public readonly recipeService: RecipeService;
	public readonly userSettingsService: UserSettingsService;

	public constructor() {
		const mobileClientProfile = getFitatuMobileClientProfile();
		const authClient = FitatuAuthClient.getInstance({ mobileClientProfile });
		const userClient = FitatuUserClient.getInstance({ authClient, mobileClientProfile });
		const dayPlanClient = new DayPlanClient({ authClient, userClient, mobileClientProfile });
		const summaryClient = new SummaryClient({ authClient, userClient, mobileClientProfile });
		const foodSearchClient = new FoodSearchClient({ authClient, userClient, mobileClientProfile });
		const recipeClient = new RecipeClient({ authClient, userClient, mobileClientProfile });
		const userSettingsClient = new UserSettingsClient({ authClient, userClient, mobileClientProfile });
		const measurementsClient = new MeasurementsClient({ authClient, userClient, mobileClientProfile });
		const foodSearchService = new FoodSearchService(foodSearchClient);

		this.currentUserService = new CurrentUserService(userClient);
		this.bodyMeasurementService = new BodyMeasurementService(measurementsClient, userClient);
		this.dayPlanQueryService = new DayPlanQueryService(dayPlanClient);
		this.dietSummaryService = new DietSummaryService(summaryClient, userClient);
		this.mealItemMutationService = new MealItemMutationService(
			dayPlanClient,
			foodSearchService,
			recipeClient,
			new MealItemMutationConfirmer(dayPlanClient, new BoundedPoller()),
		);
		this.foodSearchService = foodSearchService;
		this.recipeService = new RecipeService(
			recipeClient,
			foodSearchService,
			new RecipeMutationConfirmer(recipeClient, new BoundedPoller()),
		);
		this.userSettingsService = new UserSettingsService(userSettingsClient, userClient);
	}
}
