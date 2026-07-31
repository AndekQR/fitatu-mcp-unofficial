import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";

export class FitatuUserMeta {
	public readonly goalAchievement?: string;
	public readonly userPlannerNutritionParams?: string;

	private constructor(data: Record<string, unknown>) {
		this.goalAchievement = StringUtils.firstNonEmptyString(data.goalAchievement);
		this.userPlannerNutritionParams = StringUtils.firstNonEmptyString(data.userPlannerNutritionParams);
	}

	public static fromApiResponse(data: unknown): FitatuUserMeta | null {
		if (data === null || data === undefined) {
			return null;
		}

		return ObjectUtils.isRecord(data) ? new FitatuUserMeta(data) : null;
	}
}
