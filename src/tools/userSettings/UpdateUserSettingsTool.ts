import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AutomaticEnergyTargetUpdate } from "../../services/userSettings/AutomaticEnergyTargetUpdate.ts";
import { ManualEnergyTargetUpdate } from "../../services/userSettings/ManualEnergyTargetUpdate.ts";
import { UserSettingsService } from "../../services/userSettings/UserSettingsService.ts";
import { UserSettingsUpdate } from "../../services/userSettings/UserSettingsUpdate.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	toUserSettingsForMcp,
	userSettingsNullKeys,
	userSettingsSnapshotOutputSchema,
} from "./UserSettingsToolSchemas.ts";

const percentageSchema = z.number().int().min(0).max(100);
const manualEnergyTargetInputSchema = z
	.object({
		mode: z.literal("manual"),
		kcal: z.number().int().positive().describe("Positive whole-number daily energy target in kcal."),
		proteinPercentage: percentageSchema.describe("Whole-number protein percentage of the energy target."),
		fatPercentage: percentageSchema.describe("Whole-number fat percentage of the energy target."),
		carbohydratePercentage: percentageSchema.describe("Whole-number carbohydrate percentage of the energy target."),
	})
	.strict()
	.refine(
		({ proteinPercentage, fatPercentage, carbohydratePercentage }) =>
			proteinPercentage + fatPercentage + carbohydratePercentage === 100,
		{
			message: "Macronutrient percentages must total exactly 100",
			path: ["carbohydratePercentage"],
		},
	)
	.describe("Manual energy target whose three macronutrient percentages total exactly 100.");

const automaticEnergyTargetInputSchema = z
	.object({ mode: z.literal("automatic") })
	.strict()
	.describe("Automatic energy target calculated by Fitatu; manual values are not accepted.");

const updateUserSettingsInputSchema = z
	.object({
		energyTarget: z
			.discriminatedUnion("mode", [manualEnergyTargetInputSchema, automaticEnergyTargetInputSchema])
			.optional()
			.describe("Optional manual or automatic daily energy target update."),
		waterServingSizeMl: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Positive whole-number default water serving size in millilitres."),
	})
	.strict()
	.refine(({ energyTarget, waterServingSizeMl }) => energyTarget !== undefined || waterServingSizeMl !== undefined, {
		message: "Provide at least one user setting to update",
	})
	.meta({ minProperties: 1 });

export class UpdateUserSettingsTool {
	public static readonly toolName = "update_user_settings";
	private readonly userSettingsService: UserSettingsService;

	public constructor(userSettingsService: UserSettingsService) {
		this.userSettingsService = userSettingsService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			UpdateUserSettingsTool.toolName,
			{
				title: "Update Fitatu User Settings",
				description:
					"Partially updates the authenticated Fitatu user's supported settings. Accepts a complete manual energy target, switches energy calculation back to Fitatu automatic mode, changes the water serving size, or combines energy and water in one update. Omitted supported settings and all unsupported settings are preserved.",
				inputSchema: updateUserSettingsInputSchema,
				outputSchema: z
					.object({
						status: z.literal("updated"),
						settings: userSettingsSnapshotOutputSchema,
					})
					.strict(),
				annotations: {
					title: "Update Fitatu User Settings",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ energyTarget, waterServingSizeMl }) => {
				try {
					const energyUpdate =
						energyTarget?.mode === "manual"
							? new ManualEnergyTargetUpdate(
									energyTarget.kcal,
									energyTarget.proteinPercentage,
									energyTarget.fatPercentage,
									energyTarget.carbohydratePercentage,
								)
							: energyTarget?.mode === "automatic"
								? new AutomaticEnergyTargetUpdate()
								: undefined;
					const settings = await this.userSettingsService.updateUserSettings(
						new UserSettingsUpdate(energyUpdate, waterServingSizeMl),
					);
					return createTextResult(
						{ status: "updated", settings: toUserSettingsForMcp(settings) },
						{ keepNullKeys: userSettingsNullKeys },
					);
				} catch (error) {
					return ToolErrorResult.create(
						UpdateUserSettingsTool.toolName,
						"Unable to update Fitatu user settings.",
						error,
					);
				}
			},
		);
	}
}
