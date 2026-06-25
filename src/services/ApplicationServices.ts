import { FitatuAuthClient } from "../api/auth/FitatuAuthClient.ts";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { FoodSearchClient } from "../api/foodSearch/FoodSearchClient.ts";
import { FitatuUserClient } from "../api/users/FitatuUserClient.ts";
import { CurrentUserService } from "./currentUser/CurrentUserService.ts";
import { DayPlanQueryService } from "./dayPlan/DayPlanQueryService.ts";
import { MealItemMutationService } from "./dayPlan/MealItemMutationService.ts";
import { FoodSearchService } from "./foodSearch/FoodSearchService.ts";

/**
 * Process-wide composition root. MCP tools receive services from this class
 * rather than constructing or importing HTTP clients themselves.
 */
export class ApplicationServices {
	public readonly currentUserService: CurrentUserService;
	public readonly dayPlanQueryService: DayPlanQueryService;
	public readonly mealItemMutationService: MealItemMutationService;
	public readonly foodSearchService: FoodSearchService;

	public constructor() {
		const authClient = FitatuAuthClient.getInstance();
		const userClient = FitatuUserClient.getInstance({ authClient });
		const dayPlanClient = new DayPlanClient({ authClient, userClient });
		const foodSearchClient = new FoodSearchClient({ authClient, userClient });

		this.currentUserService = new CurrentUserService(userClient);
		this.dayPlanQueryService = new DayPlanQueryService(dayPlanClient);
		this.mealItemMutationService = new MealItemMutationService(dayPlanClient);
		this.foodSearchService = new FoodSearchService(foodSearchClient);
	}
}
