import { FitatuDietGeneration } from "./FitatuDietGeneration.ts";
import { FitatuPromoCodePlan } from "./FitatuPromoCodePlan.ts";
import { FitatuUserAppConfig } from "./FitatuUserAppConfig.ts";
import { FitatuUserMeta } from "./FitatuUserMeta.ts";

export class FitatuUserProfile {
	declare public readonly id?: string;
	declare public readonly username?: string | null;
	declare public readonly nickname?: string | null;
	declare public readonly email?: string | null;
	declare public readonly roles?: readonly string[];
	declare public readonly accessControl?: readonly string[];
	declare public readonly sex?: number | null;
	declare public readonly enabled?: boolean;
	declare public readonly createdAt?: string | null;
	declare public readonly registeredAt?: string | null;
	declare public readonly registrationSource?: number | null;
	declare public readonly hasDietSettings?: boolean | null;
	declare public readonly hasUserSettings?: boolean | null;
	declare public readonly hasActivityEnergyInclusionMode?: boolean | null;
	declare public readonly demo?: boolean;
	declare public readonly locale?: string | null;
	declare public readonly storageLocale?: string | null;
	declare public readonly searchLocale?: string | null;
	declare public readonly timezone?: string | null;
	public readonly meta: FitatuUserMeta | null;
	declare public readonly hasActivityTraining?: boolean | null;
	public readonly appConfig: FitatuUserAppConfig | null;
	declare public readonly marketingAccepted?: boolean | null;
	declare public readonly sensitiveAccepted?: boolean | null;
	declare public readonly advertisementDummyDisplayDate?: string | null;
	declare public readonly foodProposalSettings?: unknown | null;
	declare public readonly weightUnit?: string | null;
	declare public readonly sizeUnit?: string | null;
	declare public readonly facebookId?: string | null;
	declare public readonly hasPassword?: boolean | null;
	declare public readonly requestedEmailChange?: string | null;
	declare public readonly isWeightMeasurementRequired?: boolean | null;
	public readonly dietGeneration: FitatuDietGeneration | null;
	declare public readonly matchingProcess?: unknown | null;
	declare public readonly subscription?: unknown | null;
	declare public readonly partnerId?: string | null;
	public readonly promoCodePlans: readonly FitatuPromoCodePlan[];
	declare public readonly systemInfo?: string | null;
	declare public readonly systemVersion?: string | null;
	declare public readonly appVersion?: string | null;
	declare public readonly searchUrls?: readonly string[];

	private constructor(data: Record<string, unknown>) {
		Object.assign(this, data);
		this.meta = FitatuUserMeta.fromApiResponse(data.meta);
		this.appConfig = FitatuUserAppConfig.fromApiResponse(data.appConfig);
		this.dietGeneration = FitatuDietGeneration.fromApiResponse(
			data.dietGeneration,
		);
		this.promoCodePlans = FitatuPromoCodePlan.fromApiResponseArray(
			data.promoCodePlans,
		);
	}

	public static fromApiResponse(data: unknown): FitatuUserProfile {
		return new FitatuUserProfile(data as Record<string, unknown>);
	}
}
