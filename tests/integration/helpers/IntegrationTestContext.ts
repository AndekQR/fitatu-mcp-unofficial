import { FitatuAuthClient } from "../../../src/api/auth/FitatuAuthClient.ts";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { SummaryClient } from "../../../src/api/dietPlan/SummaryClient.ts";
import { FitatuApiClientBaseOptions } from "../../../src/api/fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { FitatuUserClient } from "../../../src/api/users/FitatuUserClient.ts";
import { MeasurementsClient } from "../../../src/api/users/MeasurementsClient.ts";
import { getFitatuMobileClientProfile } from "../../../src/config.ts";
import { IntegrationTestCredentialsProvider } from "./IntegrationTestCredentialsProvider.ts";

export class IntegrationTestContext {
	public readonly authClient: FitatuAuthClient;
	public readonly userClient: FitatuUserClient;
	public readonly dayPlanClient: DayPlanClient;
	public readonly summaryClient: SummaryClient;
	public readonly foodSearchClient: FoodSearchClient;
	public readonly recipeClient: RecipeClient;
	public readonly measurementsClient: MeasurementsClient;

	private constructor(environment: NodeJS.ProcessEnv) {
		const credentialsProvider = IntegrationTestCredentialsProvider.fromEnvironment(environment);
		const mobileClientProfile = getFitatuMobileClientProfile(environment);
		this.authClient = FitatuAuthClient.getInstance({
			credentialsProvider: () => credentialsProvider.getCredentials(),
			mobileClientProfile,
		});
		this.userClient = FitatuUserClient.getInstance({ authClient: this.authClient, mobileClientProfile });
		const clientOptions = new FitatuApiClientBaseOptions({
			authClient: this.authClient,
			userClient: this.userClient,
			mobileClientProfile,
		});

		this.dayPlanClient = new DayPlanClient(clientOptions);
		this.summaryClient = new SummaryClient(clientOptions);
		this.foodSearchClient = new FoodSearchClient(clientOptions);
		this.recipeClient = new RecipeClient(clientOptions);
		this.measurementsClient = new MeasurementsClient(clientOptions);
	}

	public static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): IntegrationTestContext {
		return new IntegrationTestContext(environment);
	}
}
