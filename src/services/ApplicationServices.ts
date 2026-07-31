import { FitatuAuthClient } from "../api/auth/FitatuAuthClient.ts";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { SummaryClient } from "../api/dietPlan/SummaryClient.ts";
import { FoodSearchClient } from "../api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../api/recipes/RecipeClient.ts";
import { FitatuUserClient } from "../api/users/FitatuUserClient.ts";
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

/**
 * Process-wide composition root. MCP tools receive services from this class
 * rather than constructing or importing HTTP clients themselves.
 */
export class ApplicationServices {
	public readonly currentUserService: CurrentUserService;
	public readonly dayPlanQueryService: DayPlanQueryService;
	public readonly dietSummaryService: DietSummaryService;
	public readonly mealItemMutationService: MealItemMutationService;
	public readonly foodSearchService: FoodSearchService;
	public readonly recipeService: RecipeService;

	public constructor() {
		const mobileClientProfile = getFitatuMobileClientProfile();
		const authClient = FitatuAuthClient.getInstance({ mobileClientProfile });
		const userClient = FitatuUserClient.getInstance({ authClient, mobileClientProfile });
		const dayPlanClient = new DayPlanClient({ authClient, userClient, mobileClientProfile });
		const summaryClient = new SummaryClient({ authClient, userClient, mobileClientProfile });
		const foodSearchClient = new FoodSearchClient({ authClient, userClient, mobileClientProfile });
		const recipeClient = new RecipeClient({ authClient, userClient, mobileClientProfile });

		this.currentUserService = new CurrentUserService(userClient);
		this.dayPlanQueryService = new DayPlanQueryService(dayPlanClient);
		this.dietSummaryService = new DietSummaryService(summaryClient, userClient);
		this.mealItemMutationService = new MealItemMutationService(
			dayPlanClient,
			foodSearchClient,
			recipeClient,
			new MealItemMutationConfirmer(dayPlanClient, new BoundedPoller()),
		);
		this.foodSearchService = new FoodSearchService(foodSearchClient);
		this.recipeService = new RecipeService(
			recipeClient,
			foodSearchClient,
			new RecipeMutationConfirmer(recipeClient, new BoundedPoller()),
		);
	}
}
