import { describe, expect, it } from "vitest";
import { MeasurementsClient } from "../../../../src/api/users/MeasurementsClient.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("MeasurementsClient", () => {
	it("gets and strictly decodes a body measurement and its history dates", async () => {
		const response = completeMeasurementResponse();
		const historyResponse = [
			{ date: "2026-09-06", value: 78 },
			{ date: "2026-08-20", value: 79 },
		];
		const fetchStub = createFetchStub(
			createJsonResponse(response),
			createJsonResponse(historyResponse),
			createJsonResponse(historyResponse),
		);
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		const result = await client.getMeasurement({ userId: "user/1", date: "2026-09-06" });
		const weightHistory = await client.getWeightMeasurementHistory("user/1");
		const waistHistory = await client.getSizeMeasurementHistory("user/1", "waist");

		expect(fetchStub.calls).toHaveLength(3);
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user%2F1/measurements/2026-09-06");
		expect(fetchStub.calls[0]?.init?.method).toBe("GET");
		expect(result).toEqual(response);
		expect(fetchStub.calls[1]?.input).toBe("https://fitatu.test/api/users/user%2F1/measurements/summary/weight");
		expect(fetchStub.calls[2]?.input).toBe("https://fitatu.test/api/users/user%2F1/measurements/size/waist");
		expect(weightHistory.dates).toEqual(["2026-09-06", "2026-08-20"]);
		expect(waistHistory.dates).toEqual(["2026-09-06", "2026-08-20"]);
	});

	it("saves only submitted measurements as JSON strings and returns the PUT response", async () => {
		const response = completeMeasurementResponse();
		const fetchStub = createFetchStub(createJsonResponse(response));
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		const result = await client.saveMeasurement({
			userId: "user/1",
			date: "2026-09-06",
			weightUnit: "KG",
			sizeUnit: "CM",
			weight: 78,
			waist: 86.25,
		});

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user%2F1/measurements/2026-09-06");
		expect(fetchStub.calls[0]?.init?.method).toBe("PUT");
		expect(JSON.parse(String(fetchStub.calls[0]?.init?.body))).toEqual({
			date: "2026-09-06",
			weightUnit: "KG",
			sizeUnit: "CM",
			weight: "78",
			waist: "86.25",
		});
		expect(result).toEqual(response);
	});

	it("maps only a GET 404 to a missing measurement", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "Measurement not found" }, { status: 404 }),
			createJsonResponse({ message: "Measurement not found" }, { status: 404 }),
		);
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(client.getMeasurement({ userId: "user-1", date: "2026-09-06" })).resolves.toBeNull();
		await expect(
			client.saveMeasurement({
				userId: "user-1",
				date: "2026-09-06",
				weightUnit: "KG",
				sizeUnit: "CM",
				weight: 78,
			}),
		).rejects.toMatchObject({
			operation: "measurements.save",
			failure: {
				kind: "http",
				method: "PUT",
				endpointTemplate: "/users/:userId/measurements/:date",
				statusCode: 404,
			},
		});
	});

	it("propagates non-404 GET failures with a safe endpoint template", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ message: "temporary failure" }, { status: 503 }));
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(client.getMeasurement({ userId: "user-1", date: "2026-09-06" })).rejects.toMatchObject({
			operation: "measurements.get",
			failure: {
				kind: "http",
				method: "GET",
				endpointTemplate: "/users/:userId/measurements/:date",
				statusCode: 503,
			},
		});
	});

	it.each([
		{},
		{ weight: 78 },
		{ ...completeMeasurementResponse(), weight: "78" },
		{ ...completeMeasurementResponse(), sizeUnit: "" },
	])("rejects an incomplete or mistyped upstream response", async (response) => {
		const fetchStub = createFetchStub(createJsonResponse(response));
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(client.getMeasurement({ userId: "user-1", date: "2026-09-06" })).rejects.toMatchObject({
			operation: "measurements.get",
			failure: { kind: "invalidResponse" },
		});

		const historyFetchStub = createFetchStub(createJsonResponse(response));
		const historyClient = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: historyFetchStub.fetchFn,
		});
		await expect(historyClient.getWeightMeasurementHistory("user-1")).rejects.toMatchObject({
			operation: "measurements.get",
			failure: { kind: "invalidResponse" },
		});
	});

	it.each(["2026/09/06", "2026-02-30"])("rejects invalid dates before a request", async (date) => {
		const fetchStub = createFetchStub(createJsonResponse(completeMeasurementResponse()));
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(client.getMeasurement({ userId: "user-1", date })).rejects.toMatchObject({
			operation: "measurements.get",
			failure: { kind: "invalidRequest" },
		});
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects an empty save before a request", async () => {
		const fetchStub = createFetchStub(createJsonResponse(completeMeasurementResponse()));
		const client = new MeasurementsClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});

		await expect(
			client.saveMeasurement({
				userId: "user-1",
				date: "2026-09-06",
				weightUnit: "KG",
				sizeUnit: "CM",
			}),
		).rejects.toMatchObject({ operation: "measurements.save", failure: { kind: "invalidRequest" } });
		expect(fetchStub.calls).toHaveLength(0);
	});

	it.each([{ weight: 0 }, { weight: Number.POSITIVE_INFINITY }, { fatPercentage: 101 }])(
		"rejects invalid save values before a request",
		async (values) => {
			const fetchStub = createFetchStub(createJsonResponse(completeMeasurementResponse()));
			const client = new MeasurementsClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
			});

			await expect(
				client.saveMeasurement({
					userId: "user-1",
					date: "2026-09-06",
					weightUnit: "KG",
					sizeUnit: "CM",
					...values,
				}),
			).rejects.toMatchObject({ operation: "measurements.save", failure: { kind: "invalidRequest" } });
			expect(fetchStub.calls).toHaveLength(0);
		},
	);
});

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
