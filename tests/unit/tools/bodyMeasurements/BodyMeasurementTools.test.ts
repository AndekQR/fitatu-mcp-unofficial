import { describe, expect, it } from "vitest";
import { MeasurementApiResponse } from "../../../../src/api/users/MeasurementApiResponse.ts";
import { MeasurementsClient } from "../../../../src/api/users/MeasurementsClient.ts";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { BodyMeasurement } from "../../../../src/services/bodyMeasurements/BodyMeasurement.ts";
import { BodyMeasurementService } from "../../../../src/services/bodyMeasurements/BodyMeasurementService.ts";
import type { BodyMeasurementUpdate } from "../../../../src/services/bodyMeasurements/BodyMeasurementUpdate.ts";
import { ServiceError } from "../../../../src/services/ServiceError.ts";
import { GetBodyMeasurementTool } from "../../../../src/tools/bodyMeasurements/GetBodyMeasurementTool.ts";
import { SaveBodyMeasurementTool } from "../../../../src/tools/bodyMeasurements/SaveBodyMeasurementTool.ts";
import { parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("body measurement tools", () => {
	it("returns a complete found measurement with explicit null values", async () => {
		const service = new FakeBodyMeasurementService(createMeasurement());
		const registered = await registerToolForTest(new GetBodyMeasurementTool(service));
		const latestRegistered = await registerToolForTest(new GetBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-09-06" });
		const latestResult = await latestRegistered.invoke({});
		const expected = {
			date: "2026-09-06",
			found: true,
			measurement: {
				date: "2026-09-06",
				...completeMeasurementResponse(),
			},
		};

		expect(service.getDates).toEqual(["2026-09-06", undefined]);
		expect(result.structuredContent).toEqual(expected);
		expect(parseTextContent(result)).toEqual(expected);
		expect(latestResult.structuredContent).toEqual(expected);
		expect(parseTextContent(latestResult)).toEqual(expected);
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: true,
			idempotentHint: true,
			openWorldHint: true,
		});
		expect(registered.config.outputSchema).toMatchObject({
			type: "object",
			additionalProperties: false,
			oneOf: [
				{ properties: { found: { const: false } }, not: { required: ["measurement"] } },
				{ properties: { found: { const: true } }, required: ["date", "found", "measurement"] },
			],
		});
		expect(registered.config.inputSchema).toMatchObject({
			type: "object",
			additionalProperties: false,
			properties: {
				date: { description: expect.stringContaining("defaults to the latest available entry") },
			},
		});
		expect(registered.config.inputSchema.required ?? []).not.toContain("date");
	});

	it("returns the explicit missing state without a measurement", async () => {
		const service = new FakeBodyMeasurementService(null);
		const registered = await registerToolForTest(new GetBodyMeasurementTool(service));
		const latestRegistered = await registerToolForTest(new GetBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-09-06" });
		const latestResult = await latestRegistered.invoke({});

		expect(result.structuredContent).toEqual({ date: "2026-09-06", found: false });
		expect(parseTextContent(result)).toEqual({ date: "2026-09-06", found: false });
		expect(latestResult.structuredContent).toEqual({ found: false });
		expect(parseTextContent(latestResult)).toEqual({ found: false });
	});

	it("saves one or more values and publishes the non-empty update constraint", async () => {
		const service = new FakeBodyMeasurementService(createMeasurement());
		const registered = await registerToolForTest(new SaveBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-09-06", weight: 78.126, waist: 86 });
		const expected = {
			measurement: {
				date: "2026-09-06",
				...completeMeasurementResponse(),
			},
		};

		expect(service.updates).toHaveLength(1);
		expect(service.updates[0]).toMatchObject({ date: "2026-09-06", weight: 78.13, waist: 86 });
		expect(service.updates[0]?.neck).toBeUndefined();
		expect(result.structuredContent).toEqual(expected);
		expect(parseTextContent(result)).toEqual(expected);
		expect(registered.config.inputSchema).toMatchObject({
			type: "object",
			minProperties: 2,
			additionalProperties: false,
			required: ["date"],
		});
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: true,
		});
		expect(registered.config.outputSchema).toMatchObject({
			type: "object",
			additionalProperties: false,
			required: ["measurement"],
			properties: {
				measurement: {
					type: "object",
					additionalProperties: false,
					required: [
						"date",
						"weight",
						"neck",
						"chest",
						"waist",
						"stomach",
						"hips",
						"thigh",
						"calf",
						"biceps",
						"fatPercentage",
						"weightUnit",
						"sizeUnit",
					],
				},
			},
		});
	});

	it.each([
		{ date: "2026-09-06" },
		{ date: "2026-09-06", weight: 0 },
		{ date: "2026-09-06", weight: null },
		{ date: "2026-09-06", fatPercentage: 101 },
		{ date: "2026-02-30", weight: 78 },
		{ date: "2026-09-06", weight: 78, unknown: 1 },
	])("rejects invalid save input before calling the service", async (input) => {
		const service = new FakeBodyMeasurementService(createMeasurement());
		const registered = await registerToolForTest(new SaveBodyMeasurementTool(service));

		const result = await registered.invoke(input);

		expect(result.isError).toBe(true);
		expect(service.updates).toHaveLength(0);
	});

	it("returns a safe service error without exposing internal data", async () => {
		const service = new FakeBodyMeasurementService(
			createMeasurement(),
			new ServiceError(
				"Configure weight and size units in Fitatu before saving body measurements.",
				"conflict",
				"BODY_MEASUREMENT_UNITS_UNAVAILABLE",
			),
		);
		const registered = await registerToolForTest(new SaveBodyMeasurementTool(service));

		const result = await registered.invoke({ date: "2026-09-06", weight: 78 });

		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "save_body_measurement",
			error: {
				source: "service",
				name: "ServiceError",
				message: "Configure weight and size units in Fitatu before saving body measurements.",
				kind: "conflict",
				code: "BODY_MEASUREMENT_UNITS_UNAVAILABLE",
			},
		});
	});
});

class FakeBodyMeasurementService extends BodyMeasurementService {
	public readonly getDates: Array<string | undefined> = [];
	public readonly updates: BodyMeasurementUpdate[] = [];

	public constructor(
		private readonly measurement: BodyMeasurement | null,
		private readonly error?: Error,
	) {
		super(new MeasurementsClient({ fetchFn: unusedFetch }), new UnusedFitatuUserClient());
	}

	public override async getBodyMeasurement(date?: string): Promise<BodyMeasurement | null> {
		this.getDates.push(date);
		if (this.error) throw this.error;
		return this.measurement;
	}

	public override async saveBodyMeasurement(update: BodyMeasurementUpdate): Promise<BodyMeasurement> {
		this.updates.push(update);
		if (this.error) throw this.error;
		if (!this.measurement) throw new Error("FakeBodyMeasurementService requires a measurement");
		return this.measurement;
	}
}

class UnusedFitatuUserClient extends FitatuUserClient {
	public constructor() {
		super({ fetchFn: unusedFetch });
	}
}

const unusedFetch: typeof fetch = async () => {
	throw new Error("Unexpected HTTP request from test fake");
};

function createMeasurement(): BodyMeasurement {
	return new BodyMeasurement("2026-09-06", MeasurementApiResponse.fromApiResponse(completeMeasurementResponse()));
}

function completeMeasurementResponse() {
	return {
		weight: 78,
		neck: null,
		chest: null,
		waist: 86,
		stomach: null,
		hips: null,
		thigh: null,
		calf: null,
		biceps: null,
		fatPercentage: null,
		weightUnit: "KG",
		sizeUnit: "CM",
	};
}
