import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FitatuDietGeneration } from "./FitatuDietGeneration.ts";
import { FitatuPromoCodePlan } from "./FitatuPromoCodePlan.ts";
import { FitatuUserAppConfig } from "./FitatuUserAppConfig.ts";
import { FitatuUserMeta } from "./FitatuUserMeta.ts";

export class FitatuUserProfile {
	public readonly rawData: Readonly<Record<string, unknown>>;
	public readonly id?: string;
	public readonly username?: string | null;
	public readonly nickname?: string | null;
	public readonly email?: string | null;
	public readonly roles?: readonly string[];
	public readonly accessControl?: readonly string[];
	public readonly sex?: number | null;
	public readonly enabled?: boolean;
	public readonly createdAt?: string | null;
	public readonly registeredAt?: string | null;
	public readonly registrationSource?: number | null;
	public readonly hasDietSettings?: boolean | null;
	public readonly hasUserSettings?: boolean | null;
	public readonly hasActivityEnergyInclusionMode?: boolean | null;
	public readonly demo?: boolean;
	public readonly locale?: string | null;
	public readonly storageLocale?: string | null;
	public readonly searchLocale?: string | null;
	public readonly timezone?: string | null;
	public readonly meta: FitatuUserMeta | null;
	public readonly hasActivityTraining?: boolean | null;
	public readonly appConfig: FitatuUserAppConfig | null;
	public readonly marketingAccepted?: boolean | null;
	public readonly sensitiveAccepted?: boolean | null;
	public readonly advertisementDummyDisplayDate?: string | null;
	public readonly foodProposalSettings?: unknown | null;
	public readonly weightUnit?: string | null;
	public readonly sizeUnit?: string | null;
	public readonly facebookId?: string | null;
	public readonly hasPassword?: boolean | null;
	public readonly requestedEmailChange?: string | null;
	public readonly isWeightMeasurementRequired?: boolean | null;
	public readonly dietGeneration: FitatuDietGeneration | null;
	public readonly matchingProcess?: unknown | null;
	public readonly subscription?: unknown | null;
	public readonly partnerId?: string | null;
	public readonly promoCodePlans: readonly FitatuPromoCodePlan[];
	public readonly systemInfo?: string | null;
	public readonly systemVersion?: string | null;
	public readonly appVersion?: string | null;
	public readonly searchUrls?: readonly string[];

	private constructor(data: Record<string, unknown>) {
		this.rawData = Object.freeze({ ...data });
		this.id = optionalString(data, "id");
		this.username = optionalStringOrNull(data, "username");
		this.nickname = optionalStringOrNull(data, "nickname");
		this.email = optionalStringOrNull(data, "email");
		this.roles = optionalStringArray(data, "roles");
		this.accessControl = optionalStringArray(data, "accessControl");
		this.sex = optionalNumberOrNull(data, "sex");
		this.enabled = optionalBoolean(data, "enabled");
		this.createdAt = optionalStringOrNull(data, "createdAt");
		this.registeredAt = optionalStringOrNull(data, "registeredAt");
		this.registrationSource = optionalNumberOrNull(data, "registrationSource");
		this.hasDietSettings = optionalBooleanOrNull(data, "hasDietSettings");
		this.hasUserSettings = optionalBooleanOrNull(data, "hasUserSettings");
		this.hasActivityEnergyInclusionMode = optionalBooleanOrNull(data, "hasActivityEnergyInclusionMode");
		this.demo = optionalBoolean(data, "demo");
		this.locale = optionalStringOrNull(data, "locale");
		this.storageLocale = optionalStringOrNull(data, "storageLocale");
		this.searchLocale = optionalStringOrNull(data, "searchLocale");
		this.timezone = optionalStringOrNull(data, "timezone");
		this.meta = FitatuUserMeta.fromApiResponse(data.meta);
		this.hasActivityTraining = optionalBooleanOrNull(data, "hasActivityTraining");
		this.appConfig = FitatuUserAppConfig.fromApiResponse(data.appConfig);
		this.marketingAccepted = optionalBooleanOrNull(data, "marketingAccepted");
		this.sensitiveAccepted = optionalBooleanOrNull(data, "sensitiveAccepted");
		this.advertisementDummyDisplayDate = optionalStringOrNull(data, "advertisementDummyDisplayDate");
		this.foodProposalSettings = optionalUnknownOrNull(data, "foodProposalSettings");
		this.weightUnit = optionalStringOrNull(data, "weightUnit");
		this.sizeUnit = optionalStringOrNull(data, "sizeUnit");
		this.facebookId = optionalStringOrNull(data, "facebookId");
		this.hasPassword = optionalBooleanOrNull(data, "hasPassword");
		this.requestedEmailChange = optionalStringOrNull(data, "requestedEmailChange");
		this.isWeightMeasurementRequired = optionalBooleanOrNull(data, "isWeightMeasurementRequired");
		this.dietGeneration = FitatuDietGeneration.fromApiResponse(data.dietGeneration);
		this.matchingProcess = optionalUnknownOrNull(data, "matchingProcess");
		this.subscription = optionalUnknownOrNull(data, "subscription");
		this.partnerId = optionalStringOrNull(data, "partnerId");
		this.promoCodePlans = FitatuPromoCodePlan.fromApiResponseArray(data.promoCodePlans);
		this.systemInfo = optionalStringOrNull(data, "systemInfo");
		this.systemVersion = optionalStringOrNull(data, "systemVersion");
		this.appVersion = optionalStringOrNull(data, "appVersion");
		this.searchUrls = optionalStringArray(data, "searchUrls");
	}

	public static fromApiResponse(data: unknown): FitatuUserProfile {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu user response was not a valid JSON object");
		}

		return new FitatuUserProfile(data);
	}
}

function optionalString(data: Record<string, unknown>, key: string): string | undefined {
	return key in data ? StringUtils.firstNonEmptyString(data[key]) : undefined;
}

function optionalStringOrNull(data: Record<string, unknown>, key: string): string | null | undefined {
	return key in data ? StringUtils.stringOrNull(data[key]) : undefined;
}

function optionalStringArray(data: Record<string, unknown>, key: string): readonly string[] | undefined {
	if (!(key in data) || !Array.isArray(data[key])) {
		return undefined;
	}
	return data[key].flatMap((value) => {
		const text = StringUtils.stringOrNull(value);
		return text === null ? [] : [text];
	});
}

function optionalNumberOrNull(data: Record<string, unknown>, key: string): number | null | undefined {
	if (!(key in data)) {
		return undefined;
	}
	const value = data[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
	return typeof data[key] === "boolean" ? data[key] : undefined;
}

function optionalBooleanOrNull(data: Record<string, unknown>, key: string): boolean | null | undefined {
	if (!(key in data)) {
		return undefined;
	}
	return typeof data[key] === "boolean" ? data[key] : null;
}

function optionalUnknownOrNull(data: Record<string, unknown>, key: string): unknown | null | undefined {
	return key in data ? (data[key] ?? null) : undefined;
}
