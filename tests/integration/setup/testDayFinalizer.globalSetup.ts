import { IntegrationTestDayFinalizer } from "../helpers/IntegrationTestDayFinalizer.ts";
import { getIntegrationTestCleanupDates } from "../helpers/testDates.ts";

export default async function setupTestDayFinalizer(): Promise<() => Promise<void>> {
	const finalizer = new IntegrationTestDayFinalizer();
	const dates = getIntegrationTestCleanupDates();
	await finalizer.clearDates(dates);

	return async () => {
		await finalizer.clearDates(dates);
	};
}
