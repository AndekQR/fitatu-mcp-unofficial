import { describe, expect, it } from "vitest";
import { BodyMeasurementClient } from "../../../../src/api/bodyMeasurements/BodyMeasurementClient.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "user-1" });
const storedMeasurement = {
	weight: 84.599999999999994,
	neck: null,
	chest: null,
	waist: 90,
	stomach: null,
	hips: null,
	thigh: null,
	calf: null,
	biceps: null,
	fatPercentage: null,
	weightUnit: "KG",
	sizeUnit: "CM",
};

function createClient(...responses: readonly Response[]) {
	const fetchStub = createFetchStub(...responses);
	const client = new BodyMeasurementClient({
		baseUrl: "https://fitatu.test/api",
		fetchFn: fetchStub.fetchFn,
		authClient,
	});

	return { client, fetchStub };
}

describe("BodyMeasurementClient", () => {
	it("reads a measurement for one date and rounds stored floating point values", async () => {
		const { client, fetchStub } = createClient(createJsonResponse(storedMeasurement));

		const measurement = await client.findMeasurement({ userId: "user/1", date: "2026-08-20" });

		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user%2F1/measurements/2026-08-20");
		expect(fetchStub.calls[0]?.init).toMatchObject({ method: "GET" });
		expect(measurement).toMatchObject({ date: "2026-08-20", weight: 84.6, waist: 90, weightUnit: "KG" });
		expect(measurement?.neck).toBeNull();
	});

	it("returns null when Fitatu has no measurement for the date", async () => {
		const { client } = createClient(createJsonResponse({ message: "Measurement not found" }, { status: 404 }));

		await expect(client.findMeasurement({ userId: "user-1", date: "2026-08-19" })).resolves.toBeNull();
	});

	it("sends only the provided values together with the date and units", async () => {
		const { client, fetchStub } = createClient(createJsonResponse(storedMeasurement));

		await client.saveMeasurement({
			userId: "user-1",
			date: "2026-08-20",
			weightUnit: "KG",
			sizeUnit: "CM",
			values: { weight: 84.6 },
		});

		expect(fetchStub.calls[0]?.init).toMatchObject({
			method: "PUT",
			body: JSON.stringify({ date: "2026-08-20", weight: 84.6, weightUnit: "KG", sizeUnit: "CM" }),
		});
	});

	it("rejects a save without any measurement value before making a request", async () => {
		const { client, fetchStub } = createClient();

		await expect(
			client.saveMeasurement({
				userId: "user-1",
				date: "2026-08-20",
				weightUnit: "KG",
				sizeUnit: "CM",
				values: {},
			}),
		).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "At least one measurement value is required",
			operation: "bodyMeasurement.save",
			failure: { kind: "invalidRequest" },
		});
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects a non-positive weight before making a request", async () => {
		const { client, fetchStub } = createClient();

		await expect(
			client.saveMeasurement({
				userId: "user-1",
				date: "2026-08-20",
				weightUnit: "KG",
				sizeUnit: "CM",
				values: { weight: 0 },
			}),
		).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "weight must be a positive finite number",
			failure: { kind: "invalidRequest" },
		});
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects a malformed date before making a request", async () => {
		const { client, fetchStub } = createClient();

		await expect(client.findMeasurement({ userId: "user-1", date: "20-08-2026" })).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "bodyMeasurement.get",
			failure: { kind: "invalidRequest" },
		});
		expect(fetchStub.calls).toHaveLength(0);
	});
});
