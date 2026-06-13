import { FitatuDietGeneration } from "./FitatuDietGeneration.ts";
import { FitatuPromoCodePlan } from "./FitatuPromoCodePlan.ts";
import { FitatuUserAppConfig } from "./FitatuUserAppConfig.ts";
import { FitatuUserMeta } from "./FitatuUserMeta.ts";

export class FitatuUserProfile {
  public declare readonly id?: string;
  public declare readonly username?: string | null;
  public declare readonly nickname?: string | null;
  public declare readonly email?: string | null;
  public declare readonly roles?: readonly string[];
  public declare readonly accessControl?: readonly string[];
  public declare readonly sex?: number | null;
  public declare readonly enabled?: boolean;
  public declare readonly createdAt?: string | null;
  public declare readonly registeredAt?: string | null;
  public declare readonly registrationSource?: number | null;
  public declare readonly hasDietSettings?: boolean | null;
  public declare readonly hasUserSettings?: boolean | null;
  public declare readonly hasActivityEnergyInclusionMode?: boolean | null;
  public declare readonly demo?: boolean;
  public declare readonly locale?: string | null;
  public declare readonly storageLocale?: string | null;
  public declare readonly searchLocale?: string | null;
  public declare readonly timezone?: string | null;
  public readonly meta: FitatuUserMeta | null;
  public declare readonly hasActivityTraining?: boolean | null;
  public readonly appConfig: FitatuUserAppConfig | null;
  public declare readonly marketingAccepted?: boolean | null;
  public declare readonly sensitiveAccepted?: boolean | null;
  public declare readonly advertisementDummyDisplayDate?: string | null;
  public declare readonly foodProposalSettings?: unknown | null;
  public declare readonly weightUnit?: string | null;
  public declare readonly sizeUnit?: string | null;
  public declare readonly facebookId?: string | null;
  public declare readonly hasPassword?: boolean | null;
  public declare readonly requestedEmailChange?: string | null;
  public declare readonly isWeightMeasurementRequired?: boolean | null;
  public readonly dietGeneration: FitatuDietGeneration | null;
  public declare readonly matchingProcess?: unknown | null;
  public declare readonly subscription?: unknown | null;
  public declare readonly partnerId?: string | null;
  public readonly promoCodePlans: readonly FitatuPromoCodePlan[];
  public declare readonly systemInfo?: string | null;
  public declare readonly systemVersion?: string | null;
  public declare readonly appVersion?: string | null;
  public declare readonly searchUrls?: readonly string[];

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
