import { IntegrationTestDayFinalizer } from "../helpers/IntegrationTestDayFinalizer.ts";
import { IntegrationTestContext } from "../helpers/IntegrationTestContext.ts";
import { getIntegrationTestCleanupDates } from "../helpers/testDates.ts";

export default async function setupTestDayFinalizer(): Promise<() => Promise<void>> {
	const context = IntegrationTestContext.fromEnvironment();
	try {
		await context.authClient.getSession();
	} catch {
		throw new Error(
			"Integration Test Account authentication failed. Verify FITATU_INTEGRATION_EMAIL and FITATU_INTEGRATION_PASSWORD.",
		);
	}
	const finalizer = new IntegrationTestDayFinalizer(context.dayPlanClient);
	const dates = getIntegrationTestCleanupDates();
	await finalizer.clearDates(dates);

	return async () => {
		await finalizer.clearDates(dates);
	};
}
