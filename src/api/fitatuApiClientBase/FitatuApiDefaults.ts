import { FitatuMobileClientProfile } from "./FitatuMobileClientProfile.ts";

export const DEFAULT_FITATU_API_BASE_URL = "https://fitatu.com/api";
export const DEFAULT_APP_LOCALE = "en_GB";
export const DEFAULT_APP_TIMEZONE = "Europe/Warsaw";
export const DEFAULT_FITATU_USER_AGENT = "Dart/3.10 (dart:io)";
export const DEFAULT_FITATU_APP_VERSION = "4.14.4";
export const DEFAULT_FITATU_API_APK_UUID = "BE4B.251210.005";
export const DEFAULT_FITATU_MOBILE_CLIENT_PROFILE = new FitatuMobileClientProfile(
	DEFAULT_FITATU_USER_AGENT,
	DEFAULT_FITATU_APP_VERSION,
	DEFAULT_FITATU_API_APK_UUID,
);

export const DEFAULT_FITATU_HEADERS = {
	"accept-encoding": "gzip",
	"content-type": "application/json;charset=UTF-8",
	"app-os": "ANDROID",
	"api-secret": "PYRXtfs88UDJMuCCrNpLV",
	"app-uuid": "64c2d1b0-c8ad-11e8-8956-0242ac120008",
	"api-key": "FITATU-MOBILE-APP",
} as const;
