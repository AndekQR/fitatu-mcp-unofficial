import { describe, expect, it } from "vitest";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";

describe("DayRevisions", () => {
	it("stores validated day revisions and serializes a frozen record", () => {
		const revisions = DayRevisions.fromRecord({
			"2026-07-12": "revision-1",
			"2026-07-13": "revision-2",
		});

		const serialized = revisions.toRecord();

		expect(serialized).toEqual({
			"2026-07-12": "revision-1",
			"2026-07-13": "revision-2",
		});
		expect(Object.isFrozen(serialized)).toBe(true);
	});

	it("rejects invalid dates and empty revisions", () => {
		expect(() => DayRevisions.fromRecord({ "12-07-2026": "revision-1" })).toThrow(
			"day revision date must use YYYY-MM-DD format",
		);
		expect(() => DayRevisions.fromRecord({ "2026-07-12": " " })).toThrow("day revision is required");
	});
});
