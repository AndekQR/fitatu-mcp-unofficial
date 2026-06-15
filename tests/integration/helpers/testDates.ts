const DEFAULT_TEST_DATE = "2035-02-15";

export function getIntegrationTestDate(): string {
	return normalizeDate(process.env.FITATU_INTEGRATION_TEST_DATE ?? DEFAULT_TEST_DATE);
}

export function addDays(date: string, days: number): string {
	const parsed = new Date(`${normalizeDate(date)}T00:00:00.000Z`);
	parsed.setUTCDate(parsed.getUTCDate() + days);
	return parsed.toISOString().slice(0, 10);
}

function normalizeDate(value: string): string {
	const date = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Error("FITATU_INTEGRATION_TEST_DATE must use YYYY-MM-DD format");
	}

	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new Error("FITATU_INTEGRATION_TEST_DATE must be a valid calendar date");
	}

	return date;
}
