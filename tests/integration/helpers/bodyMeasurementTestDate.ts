import { DateUtils } from "../../../src/shared/DateUtils.ts";
import { ValidationError } from "../../../src/shared/ValidationError.ts";

export function getBodyMeasurementIntegrationTestDate(): string | null {
	const configuredDate = process.env.FITATU_INTEGRATION_BODY_MEASUREMENT_DATE?.trim();
	if (!configuredDate) {
		return null;
	}

	try {
		return DateUtils.validateIsoDate(configuredDate);
	} catch (error) {
		if (!(error instanceof ValidationError)) throw error;
		throw new Error("FITATU_INTEGRATION_BODY_MEASUREMENT_DATE must be a valid calendar date in YYYY-MM-DD format");
	}
}
