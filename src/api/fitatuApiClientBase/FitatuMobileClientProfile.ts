import { StringUtils } from "../../shared/StringUtils.ts";

export class FitatuMobileClientProfile {
	public readonly userAgent: string;
	public readonly appVersion: string;
	public readonly apiApkUuid: string;

	public constructor(userAgent: string, appVersion: string, apiApkUuid: string) {
		this.userAgent = StringUtils.parseNonEmptyString(userAgent, "Fitatu user agent is required");
		this.appVersion = StringUtils.parseNonEmptyString(appVersion, "Fitatu app version is required");
		this.apiApkUuid = StringUtils.parseNonEmptyString(apiApkUuid, "Fitatu API APK UUID is required");
	}

	public toHeaders(): Readonly<Record<string, string>> {
		return {
			"user-agent": this.userAgent,
			"app-version": this.appVersion,
			"api-apk-uuid": this.apiApkUuid,
		};
	}
}
