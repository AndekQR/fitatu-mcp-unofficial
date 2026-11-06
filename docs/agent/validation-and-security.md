# Validation, errors, and sensitive data

Validate all MCP tool inputs before making a Fitatu request. Validate upstream response shapes before using them to construct production models.

Use explicit errors where useful, including for:

- invalid input;
- authentication failures;
- HTTP or transport failures;
- unexpected upstream response shapes;
- service-level policy or confirmation failures.

Errors should be actionable but safe. Never expose or log:

- passwords or account credentials;
- access or refresh tokens;
- cookies or authorization headers;
- full request bodies containing personal data;
- full upstream responses containing personal data;
- raw stack traces in MCP-facing responses;
- personal nutrition logs, body measurements, profile data, or user identifiers unless explicitly required by a safe public contract.
