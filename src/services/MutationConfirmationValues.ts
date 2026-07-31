export class MutationConfirmationValues {
	public static sameIdentifier(actual: string | number | null, expected: string | number): boolean {
		return actual !== null && String(actual) === String(expected);
	}

	public static sameNullableIdentifier(actual: string | number | null, expected: string | number | null): boolean {
		return actual === null || expected === null ? actual === expected : String(actual) === String(expected);
	}

	public static sameNumber(actual: number | null, expected: number): boolean {
		return actual !== null && Math.round(actual * 100) === Math.round(expected * 100);
	}

	public static sameNullableNumber(actual: number | null, expected: number | null): boolean {
		return actual === null || expected === null ? actual === expected : this.sameNumber(actual, expected);
	}
}
