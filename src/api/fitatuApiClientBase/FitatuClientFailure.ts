import type { FitatuAuthenticationFailure } from "./FitatuAuthenticationFailure.ts";
import type { FitatuHttpFailure } from "./FitatuHttpFailure.ts";
import type { FitatuInvalidRequestFailure } from "./FitatuInvalidRequestFailure.ts";
import type { FitatuInvalidResponseFailure } from "./FitatuInvalidResponseFailure.ts";
import type { FitatuTransportFailure } from "./FitatuTransportFailure.ts";

export type FitatuRequestFailure = FitatuHttpFailure | FitatuInvalidResponseFailure | FitatuTransportFailure;

export type FitatuClientFailure = FitatuAuthenticationFailure | FitatuInvalidRequestFailure | FitatuRequestFailure;
