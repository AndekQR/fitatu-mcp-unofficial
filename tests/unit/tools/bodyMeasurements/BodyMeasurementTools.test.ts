import { describe, expect, it } from "vitest";
import { BodyMeasurement } from "../../../../src/api/bodyMeasurements/BodyMeasurement.ts";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { BodyMeasurementProvider } from "../../../../src/services/bodyMeasurements/BodyMeasurementService.ts";
import type { SaveBodyMeasurementInput } from "../../../../src/services/bodyMeasurements/SaveBodyMeasurementInput.ts";
import { GetBodyMeasurementTool } from "../../../../src/tools/bodyMeasurements/GetBodyMeasurementTool.ts";
import { SaveBodyMeasurementTool } from "../../../../src/tools/bodyMeasurements/SaveBodyMeasurementTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

function createMeasurement(date: string, values: Record<string, number>): BodyMeasurement {
	return BodyMeasurement.fromApiResponse(date, { ...values, weightUnit: "KG", sizeUnit: "CM" });
}

class FakeBodyMeasurementService implements BodyMeasurementProvider {
	public readonly savedInputs: SaveBodyMeasurementInput[] = [];
	public requestedDates: string[] = [];

	private readonly measurement: BodyMeasurement | null;

	public constructor(measurement: BodyMeasurement | null) {
		this.measurement = measurement;
	}

	public async getMeasurement(date: string): Promise<BodyMeasurement | null> {
		this.requestedDates.push(date);
		return this.measurement;
	}

	public async saveMeasurement(input: SaveBodyMeasurementInput): Promise<BodyMeasurement> {
		this.savedInputs.push(input);
		if (!this.measurement) {
			throw new Error("Test service has no measurement configured");
		}

		return this.measurement;
	}
}

describe("GetBodyMeasurementTool", () => {
	it("returns the stored measurement for a date", async () => {
		const service = new FakeBodyMeasurementService(createMeasurement("2026-08-20", { weight: 84.6, waist: 90 }));
		const registered = await registerToolForTest(new GetBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-08-20" });
		const expectedContent = {
			date: "2026-08-20",
			found: true,
			measurement: { date: "2026-08-20", weight: 84.6, waist: 90, weightUnit: "KG", sizeUnit: "CM" },
		};

		expect(service.requestedDates).toEqual(["2026-08-20"]);
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(result.structuredContent).toEqual(expectedContent);
		expect(parseTextContent(result)).toEqual(expectedContent);
	});

	it("reports a missing measurement without an error result", async () => {
		const registered = await registerToolForTest(new GetBodyMeasurementTool(new FakeBodyMeasurementService(null)));

		const result = await registered.invoke({ date: "2026-08-19" });

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual({ date: "2026-08-19", found: false });
	});

	it("rejects a date that is not a calendar date", async () => {
		const registered = await registerToolForTest(new GetBodyMeasurementTool(new FakeBodyMeasurementService(null)));

		const result = await registered.invoke({ date: "2026-02-30" });

		expect(result.isError).toBe(true);
	});
});

describe("SaveBodyMeasurementTool", () => {
	it("forwards only the provided values and returns the persisted measurement", async () => {
		const service = new FakeBodyMeasurementService(createMeasurement("2026-08-20", { weight: 84.6, waist: 90 }));
		const registered = await registerToolForTest(new SaveBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-08-20", weight: 84.6 });

		expect(service.savedInputs).toHaveLength(1);
		expect(service.savedInputs[0]).toMatchObject({ date: "2026-08-20", values: { weight: 84.6 } });
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
		expect(result.structuredContent).toEqual({
			date: "2026-08-20",
			measurement: { date: "2026-08-20", weight: 84.6, waist: 90, weightUnit: "KG", sizeUnit: "CM" },
		});
	});

	it("rejects a save without any measurement value", async () => {
		const service = new FakeBodyMeasurementService(createMeasurement("2026-08-20", { weight: 84.6 }));
		const registered = await registerToolForTest(new SaveBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-08-20" });

		expect(result.isError).toBe(true);
		expect(service.savedInputs).toHaveLength(0);
	});

	it("returns a safe structured error for a Fitatu failure", async () => {
		const clientError = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.bodyMeasurementSave,
			message: "Fitatu body measurement update failed",
			method: "PUT",
			endpointTemplate: "/users/:userId/measurements/:date",
			response: new Response(JSON.stringify({ message: "Validation failed" }), { status: 400 }),
		});
		const registered = await registerToolForTest(
			new SaveBodyMeasurementTool({
				saveMeasurement: async () => {
					throw clientError;
				},
			}),
		);

		const result = await registered.invoke({ date: "2026-08-20", weight: 84.6 });

		expect(result.isError).toBe(true);
		expect(getTextContent(result)).toContain("save_body_measurement");
		expect(getTextContent(result)).not.toContain("Bearer");
	});
});
