import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { DayPlanError } from "../../../src/api/dayPlan/DayPlanError.ts";
import type { GetEnergySummaryResponse } from "../../../src/api/dietPlan/GetEnergySummaryResponse.ts";
import type { GetSummaryResponse } from "../../../src/api/dietPlan/GetSummaryResponse.ts";
import { FitatuUserProfile } from "../../../src/api/users/FitatuUserProfile.ts";
import { DietSummaryService } from "../../../src/services/dietSummary/DietSummaryService.ts";
import type { DietSummaryResult } from "../../../src/services/dietSummary/DietSummaryTypes.ts";
import { GetDietSummaryTool } from "../../../src/tools/dietSummary/GetDietSummaryTool.ts";

describe("DietSummaryService integration", () => {
	it("combines summary and energy endpoints into an agent-friendly period summary", async () => {
		const summaryClient = new FakeSummaryClient({
			summary: {
				energy: { current: 2200.444, min: null, max: 3000, eaten: 2200.444 },
				protein: { current: 50, min: 70, max: 120, eaten: 50 },
				fat: { current: 140, min: 40, max: 100, eaten: 140 },
				carbohydrate: { current: 250, min: 200, max: 300, eaten: 250 },
				sodium: { current: 900, min: null, max: 1500, eaten: 900 },
				customTraceElement: { current: 12, min: null, max: null, eaten: 12 },
			},
			energySummary: {
				targets: {
					"2026-06-29": 2500,
					"2026-06-30": 2500,
					"2026-07-01": 2500,
				},
				measures: {
					"2026-06-29": 2000,
					"2026-06-30": 2600,
					"2026-07-01": 1000,
				},
			},
		});
		const service = createService(summaryClient);

		const result = await service.getDietSummary({ fromDate: "2026-06-29", toDate: "2026-07-01" });

		expect(summaryClient.calls).toEqual([
			{
				kind: "summary",
				userId: "user-123",
				fromDate: "2026-06-29",
				toDate: "2026-07-01",
			},
			{
				kind: "energy",
				userId: "user-123",
				fromDate: "2026-06-29",
				toDate: "2026-07-01",
			},
		]);
		expect(result.period).toEqual({
			fromDate: "2026-06-29",
			toDate: "2026-07-01",
			dayCount: 3,
		});
		expect(result.energy).toEqual({
			loggedTotal: 5600,
			targetTotal: 7500,
			averageLogged: 1866.67,
			averageTarget: 2500,
			remainingToTarget: 1900,
			daily: [
				{ date: "2026-06-29", logged: 2000, target: 2500, remainingToTarget: 500 },
				{ date: "2026-06-30", logged: 2600, target: 2500, remainingToTarget: -100 },
				{ date: "2026-07-01", logged: 1000, target: 2500, remainingToTarget: 1500 },
			],
		});
		expect(result.keyNutrients.map((item) => item.key)).toEqual([
			"energy",
			"protein",
			"fat",
			"carbohydrate",
			"sodium",
		]);
		expect(findNutrient(result, "energy")).toMatchObject({
			key: "energy",
			label: "Energy",
			unit: "kcal",
			current: 2200.44,
			max: 3000,
			status: "withinRange",
			remainingToMaximum: 799.56,
		});
		expect(findNutrient(result, "protein")).toMatchObject({
			status: "belowMin",
			amountToMinimum: 20,
			remainingToMaximum: 70,
		});
		expect(findNutrient(result, "fat")).toMatchObject({
			status: "aboveMax",
			amountOverMaximum: 40,
		});
		expect(findNutrient(result, "customTraceElement")).toMatchObject({
			key: "customTraceElement",
			label: "Custom Trace Element",
			status: "noTarget",
		});
		expect(result.allNutrients).toHaveLength(6);
	});

	it("handles missing daily energy values and null nutrient values without inventing numbers", async () => {
		const summaryClient = new FakeSummaryClient({
			summary: {
				water: { current: null, min: null, max: 2000, eaten: null },
				fiber: { current: 25, min: 20, max: null, eaten: null },
			},
			energySummary: {
				targets: {
					"2026-07-01": 2500,
				},
				measures: {
					"2026-07-02": 1200,
				},
			},
		});
		const service = createService(summaryClient);

		const result = await service.getDietSummary({ fromDate: "2026-07-01", toDate: "2026-07-03" });

		expect(result.energy).toEqual({
			loggedTotal: 1200,
			targetTotal: 2500,
			averageLogged: 400,
			averageTarget: 833.33,
			remainingToTarget: 1300,
			daily: [
				{ date: "2026-07-01", logged: 0, target: 2500, remainingToTarget: 2500 },
				{ date: "2026-07-02", logged: 1200, target: null, remainingToTarget: null },
				{ date: "2026-07-03", logged: 0, target: null, remainingToTarget: null },
			],
		});
		expect(findNutrient(result, "water")).toMatchObject({
			status: "noValue",
			current: null,
			max: 2000,
		});
		expect(findNutrient(result, "fiber")).toMatchObject({
			status: "withinRange",
			remainingToMaximum: undefined,
		});
	});

	it("rejects a date range where fromDate is after toDate before calling Fitatu", async () => {
		const summaryClient = new FakeSummaryClient();
		const service = createService(summaryClient);

		await expect(service.getDietSummary({ fromDate: "2026-07-03", toDate: "2026-07-01" })).rejects.toThrow(
			"fromDate must be before or equal to toDate",
		);
		expect(summaryClient.calls).toHaveLength(0);
	});

	it("rejects invalid calendar dates before calling Fitatu", async () => {
		const summaryClient = new FakeSummaryClient();
		const service = createService(summaryClient);

		await expect(service.getDietSummary({ fromDate: "2026-02-30", toDate: "2026-03-01" })).rejects.toThrow(
			"fromDate must be a valid calendar date",
		);
		expect(summaryClient.calls).toHaveLength(0);
	});

	it("rejects year zero before calling Fitatu", async () => {
		const summaryClient = new FakeSummaryClient();
		const service = createService(summaryClient);

		await expect(service.getDietSummary({ fromDate: "0000-01-01", toDate: "0000-01-01" })).rejects.toThrow(
			"fromDate year must be between 0001 and 9999",
		);
		expect(summaryClient.calls).toHaveLength(0);
	});

	it("rejects incorrectly formatted dates before calling Fitatu", async () => {
		const summaryClient = new FakeSummaryClient();
		const service = createService(summaryClient);

		await expect(service.getDietSummary({ fromDate: "2026/07/01", toDate: "2026-07-01" })).rejects.toThrow(
			"fromDate must use YYYY-MM-DD format",
		);
		expect(summaryClient.calls).toHaveLength(0);
	});

	it("rejects missing authenticated user id before calling Fitatu summary endpoints", async () => {
		const summaryClient = new FakeSummaryClient();
		const service = new DietSummaryService(summaryClient, new FakeUserClient(null));

		await expect(service.getDietSummary({ fromDate: "2026-07-01", toDate: "2026-07-01" })).rejects.toThrow(
			"Fitatu user id is required",
		);
		expect(summaryClient.calls).toHaveLength(0);
	});
});

describe("GetDietSummaryTool integration", () => {
	it("returns structured content for a successful diet summary", async () => {
		const summary = createToolSummary();
		const tool = new GetDietSummaryTool(new FakeDietSummaryService(summary) as unknown as DietSummaryService);
		const handler = registerToolForTest(tool);

		const result = await handler({ fromDate: "2026-07-01", toDate: "2026-07-01" });
		const compactSummary = {
			...summary,
			allNutrients: [
				{
					key: "energy",
					label: "Energy",
					unit: "kcal",
					current: 2000,
					max: 2500,
					eaten: 2000,
					status: "withinRange",
					remainingToMaximum: 500,
				},
			],
		};

		expect(result.isError).toBeUndefined();
		expect(result.structuredContent).toEqual(compactSummary);
		expect(result.content).toEqual([
			{
				type: "text",
				text: JSON.stringify(compactSummary, null, 2),
			},
		]);
	});

	it("returns a safe structured MCP error for invalid tool input handled by the service", async () => {
		const tool = new GetDietSummaryTool(
			new FakeDietSummaryService(
				undefined,
				new DayPlanError("fromDate must be before or equal to toDate"),
			) as unknown as DietSummaryService,
		);
		const handler = registerToolForTest(tool);

		const result = await handler({ fromDate: "2026-07-03", toDate: "2026-07-01" });
		const expectedError = {
			status: "error",
			toolName: "get_diet_summary",
			errorName: "DayPlanError",
			message: "fromDate must be before or equal to toDate",
		};

		expect(result.isError).toBe(true);
		expect(result.structuredContent).toBeUndefined();
		expect(result.content).toEqual([
			{
				type: "text",
				text: JSON.stringify(expectedError, null, 2),
			},
		]);
	});

	it("does not expose generic unexpected error messages to MCP callers", async () => {
		const tool = new GetDietSummaryTool(
			new FakeDietSummaryService(
				undefined,
				new Error("upstream token secret leaked in stack"),
			) as unknown as DietSummaryService,
		);
		const handler = registerToolForTest(tool);

		const result = await handler({ fromDate: "2026-07-01", toDate: "2026-07-01" });

		expect(result.isError).toBe(true);
		expect(result.structuredContent).toBeUndefined();
		const content = result.content[0];
		if (content?.type !== "text") {
			throw new Error("Expected a text MCP error result");
		}
		expect(JSON.parse(content.text)).toEqual({
			status: "error",
			toolName: "get_diet_summary",
			errorName: "Error",
			message: "Unable to fetch Fitatu diet summary.",
		});
		expect(content.text).not.toContain("upstream token secret");
	});
});

class FakeSummaryClient {
	public readonly calls: {
		readonly kind: "summary" | "energy";
		readonly userId: string;
		readonly fromDate: string;
		readonly toDate: string;
	}[] = [];

	private readonly summary: GetSummaryResponse;
	private readonly energySummary: GetEnergySummaryResponse;

	public constructor(
		options: { readonly summary?: GetSummaryResponse; readonly energySummary?: GetEnergySummaryResponse } = {},
	) {
		this.summary = options.summary ?? {};
		this.energySummary = options.energySummary ?? { targets: {}, measures: {} };
	}

	public async getSummary(request: {
		readonly userId: string;
		readonly fromDate: string;
		readonly toDate: string;
	}): Promise<GetSummaryResponse> {
		this.calls.push({ kind: "summary", ...request });
		return this.summary;
	}

	public async getEnergySummary(request: {
		readonly userId: string;
		readonly fromDate: string;
		readonly toDate: string;
	}): Promise<GetEnergySummaryResponse> {
		this.calls.push({ kind: "energy", ...request });
		return this.energySummary;
	}
}

class FakeUserClient {
	public constructor(private readonly userId: string | null = "user-123") {}

	public async getAuthenticatedUser(): Promise<FitatuUserProfile> {
		return FitatuUserProfile.fromApiResponse({ id: this.userId });
	}
}

class FakeDietSummaryService {
	public constructor(
		private readonly summary?: DietSummaryResult,
		private readonly error?: Error,
	) {}

	public async getDietSummary(): Promise<DietSummaryResult> {
		if (this.error) {
			throw this.error;
		}
		if (!this.summary) {
			throw new Error("FakeDietSummaryService requires a summary or error");
		}

		return this.summary;
	}
}

function createService(summaryClient: FakeSummaryClient): DietSummaryService {
	return new DietSummaryService(summaryClient, new FakeUserClient());
}

function findNutrient(result: DietSummaryResult, key: string) {
	const nutrient = result.allNutrients.find((item) => item.key === key);
	if (!nutrient) {
		throw new Error(`Expected nutrient ${key}`);
	}

	return nutrient;
}

function createToolSummary(): DietSummaryResult {
	return {
		period: {
			fromDate: "2026-07-01",
			toDate: "2026-07-01",
			dayCount: 1,
		},
		energy: {
			loggedTotal: 2000,
			targetTotal: 2500,
			averageLogged: 2000,
			averageTarget: 2500,
			remainingToTarget: 500,
			daily: [{ date: "2026-07-01", logged: 2000, target: 2500, remainingToTarget: 500 }],
		},
		keyNutrients: [],
		allNutrients: [
			{
				key: "energy",
				label: "Energy",
				unit: "kcal",
				current: 2000,
				min: null,
				max: 2500,
				eaten: 2000,
				status: "withinRange",
				remainingToMaximum: 500,
			},
		],
	};
}

function registerToolForTest(
	tool: GetDietSummaryTool,
): (input: { readonly fromDate: string; readonly toDate: string }) => Promise<CallToolResult> {
	let handler:
		| ((input: { readonly fromDate: string; readonly toDate: string }) => Promise<CallToolResult>)
		| undefined;
	const server = {
		registerTool: (
			_name: string,
			_config: unknown,
			callback: (input: { readonly fromDate: string; readonly toDate: string }) => Promise<CallToolResult>,
		) => {
			handler = callback;
		},
	} as unknown as McpServer;

	tool.register(server);

	if (!handler) {
		throw new Error("GetDietSummaryTool did not register a handler");
	}

	return handler;
}
