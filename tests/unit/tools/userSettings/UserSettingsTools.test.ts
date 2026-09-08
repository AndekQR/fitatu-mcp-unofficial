import { describe, expect, it } from "vitest";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { UserSettingsClient } from "../../../../src/api/users/UserSettingsClient.ts";
import { AutomaticEnergyTarget } from "../../../../src/services/userSettings/AutomaticEnergyTarget.ts";
import { MacronutrientDistribution } from "../../../../src/services/userSettings/MacronutrientDistribution.ts";
import { ManualEnergyTarget } from "../../../../src/services/userSettings/ManualEnergyTarget.ts";
import { UserSettingsCalculatedValues } from "../../../../src/services/userSettings/UserSettingsCalculatedValues.ts";
import { UserSettingsService } from "../../../../src/services/userSettings/UserSettingsService.ts";
import { UserSettingsSnapshot } from "../../../../src/services/userSettings/UserSettingsSnapshot.ts";
import type { UserSettingsUpdate } from "../../../../src/services/userSettings/UserSettingsUpdate.ts";
import { ServiceError } from "../../../../src/services/ServiceError.ts";
import { GetUserSettingsTool } from "../../../../src/tools/userSettings/GetUserSettingsTool.ts";
import { UpdateUserSettingsTool } from "../../../../src/tools/userSettings/UpdateUserSettingsTool.ts";
import { parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("user settings tools", () => {
	it("gets today's normalized settings while preserving explicit null macro targets", async () => {
		const service = new FakeUserSettingsService(automaticSnapshot());
		const registered = await registerToolForTest(new GetUserSettingsTool(service));

		const result = await registered.invoke({});
		const expected = {
			settings: {
				date: "2026-09-07",
				energyTarget: {
					mode: "automatic",
					kcal: 2700,
					proteinPercentage: null,
					fatPercentage: null,
					carbohydratePercentage: null,
				},
				calculatedValues: {
					basalMetabolicRateKcal: 1800,
					totalMetabolicRateKcal: 2700,
					physicalActivityLevel: 1.5,
					calculatedEnergyKcal: 2700,
					energyDeficitKcal: 0,
					activityEnergyKcal: 120,
				},
				waterServingSizeMl: 250,
			},
		};

		expect(service.getDates).toEqual([undefined]);
		expect(result.structuredContent).toEqual(expected);
		expect(parseTextContent(result)).toEqual(expected);
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
		});
	});

	it("updates a manual energy target and water through the strict public contract", async () => {
		const service = new FakeUserSettingsService(manualFractionalSnapshot());
		const registered = await registerToolForTest(new UpdateUserSettingsTool(service));

		const result = await registered.invoke({
			energyTarget: {
				mode: "manual",
				kcal: 2250,
				proteinPercentage: 15,
				fatPercentage: 25,
				carbohydratePercentage: 60,
			},
			waterServingSizeMl: 300,
		});

		expect(service.updates).toHaveLength(1);
		expect(service.updates[0]).toMatchObject({
			energyTarget: {
				mode: "manual",
				kcal: 2250,
				proteinPercentage: 15,
				fatPercentage: 25,
				carbohydratePercentage: 60,
			},
			waterServingSizeMl: 300,
		});
		expect(result.structuredContent).toMatchObject({
			status: "updated",
			settings: {
				date: "2026-09-07",
				energyTarget: {
					mode: "manual",
					proteinPercentage: 20.5,
					fatPercentage: 29.5,
					carbohydratePercentage: 50,
				},
			},
		});
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
		});
		expect(registered.config.inputSchema).toMatchObject({
			type: "object",
			minProperties: 1,
			additionalProperties: false,
			properties: {
				energyTarget: {
					oneOf: [
						{
							additionalProperties: false,
							required: ["mode", "kcal", "proteinPercentage", "fatPercentage", "carbohydratePercentage"],
							description: expect.stringContaining("total exactly 100"),
						},
						{ additionalProperties: false, required: ["mode"] },
					],
				},
			},
		});
	});

	it("switches energy calculation to automatic without accepting manual values", async () => {
		const service = new FakeUserSettingsService(automaticSnapshot());
		const registered = await registerToolForTest(new UpdateUserSettingsTool(service));

		const result = await registered.invoke({ energyTarget: { mode: "automatic" } });

		expect(service.updates).toHaveLength(1);
		expect(service.updates[0]).toMatchObject({ energyTarget: { mode: "automatic" } });
		expect(result.structuredContent).toMatchObject({
			status: "updated",
			settings: { energyTarget: { mode: "automatic", kcal: 2700 } },
		});
	});

	it.each([
		{},
		{ unknown: true },
		{ waterServingSizeMl: 0 },
		{ waterServingSizeMl: 200.5 },
		{ energyTarget: { mode: "automatic", kcal: 2200 } },
		{ energyTarget: { mode: "manual", kcal: 2200, proteinPercentage: 20, fatPercentage: 30 } },
		{
			energyTarget: {
				mode: "manual",
				kcal: 2200,
				proteinPercentage: 20,
				fatPercentage: 30,
				carbohydratePercentage: 49,
			},
		},
		{
			energyTarget: {
				mode: "manual",
				kcal: 2200,
				proteinPercentage: 20.5,
				fatPercentage: 29.5,
				carbohydratePercentage: 50,
			},
		},
	])("rejects invalid update input before calling the service", async (input) => {
		const service = new FakeUserSettingsService(automaticSnapshot());
		const registered = await registerToolForTest(new UpdateUserSettingsTool(service));

		const result = await registered.invoke(input);

		expect(result.isError).toBe(true);
		expect(service.updates).toHaveLength(0);
	});

	it("rejects an impossible read date before calling the service", async () => {
		const service = new FakeUserSettingsService(automaticSnapshot());
		const registered = await registerToolForTest(new GetUserSettingsTool(service));

		const result = await registered.invoke({ date: "2026-02-30" });

		expect(result.isError).toBe(true);
		expect(service.getDates).toHaveLength(0);
	});

	it("returns a safe service error", async () => {
		const service = new FakeUserSettingsService(
			automaticSnapshot(),
			new ServiceError(
				"Configure a timezone in Fitatu before requesting settings without a date.",
				"conflict",
				"USER_TIMEZONE_UNAVAILABLE",
			),
		);
		const registered = await registerToolForTest(new GetUserSettingsTool(service));

		const result = await registered.invoke({});

		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "get_user_settings",
			error: {
				source: "service",
				name: "ServiceError",
				message: "Configure a timezone in Fitatu before requesting settings without a date.",
				kind: "conflict",
				code: "USER_TIMEZONE_UNAVAILABLE",
			},
		});
	});
});

class FakeUserSettingsService extends UserSettingsService {
	public readonly getDates: Array<string | undefined> = [];
	public readonly updates: UserSettingsUpdate[] = [];
	private readonly snapshot: UserSettingsSnapshot;
	private readonly error?: Error;

	public constructor(snapshot: UserSettingsSnapshot, error?: Error) {
		super(new UserSettingsClient({ fetchFn: unusedFetch }), new UnusedFitatuUserClient());
		this.snapshot = snapshot;
		this.error = error;
	}

	public override async getUserSettings(date?: string): Promise<UserSettingsSnapshot> {
		this.getDates.push(date);
		if (this.error) throw this.error;
		return this.snapshot;
	}

	public override async updateUserSettings(update: UserSettingsUpdate): Promise<UserSettingsSnapshot> {
		this.updates.push(update);
		if (this.error) throw this.error;
		return this.snapshot;
	}
}

class UnusedFitatuUserClient extends FitatuUserClient {
	public constructor() {
		super({ fetchFn: unusedFetch });
	}
}

function automaticSnapshot(): UserSettingsSnapshot {
	return new UserSettingsSnapshot(
		"2026-09-07",
		new AutomaticEnergyTarget(2700, new MacronutrientDistribution(null, null, null)),
		new UserSettingsCalculatedValues(1800, 2700, 1.5, 2700, 0, 120),
		250,
	);
}

function manualFractionalSnapshot(): UserSettingsSnapshot {
	return new UserSettingsSnapshot(
		"2026-09-07",
		new ManualEnergyTarget(2250, new MacronutrientDistribution(20.5, 29.5, 50)),
		undefined,
		300,
	);
}

const unusedFetch: typeof fetch = async () => {
	throw new Error("Unexpected HTTP request from test fake");
};
