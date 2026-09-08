import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export function requireFiniteUserSettingsNumber(value: unknown, section: string, fieldName: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new FitatuResponseDecodeError(`Fitatu ${section} ${fieldName} was not a finite number`);
	}
	return value;
}
