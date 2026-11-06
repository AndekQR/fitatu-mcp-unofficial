# Fitatu HTTP integration

Implement Fitatu calls through the dedicated API client layer, never as scattered direct `fetch` calls.

API clients own HTTP concerns such as endpoints, request construction, authentication, technical retries or fallbacks, status and transport error mapping,
JSON decoding, and technical response validation. Services own input normalization, domain mapping, filtering, ranking, deduplication, enrichment, multi-call
orchestration, partial-failure policy, confirmation policy, and user-facing warnings.

The HTTP layer should handle:

- base URL configuration;
- request paths and query parameters;
- request headers and configured authorization values;
- JSON serialization and parsing;
- HTTP status and transport failures;
- safe technical error mapping.

Use captured HTTP traffic only for legitimate work with the user's own account and network traffic. Do not build functionality intended to bypass
authentication, steal credentials, evade limits, scrape at scale, or access accounts that do not belong to the user.
