# Testing

Do not add new test files or new test cases unless the user explicitly requests them. Existing tests may be updated when required by an implementation or
contract change.

- Unit tests must be deterministic and must not load real Fitatu credentials.
- Integration tests run as the dedicated Fitatu test user configured with `FITATU_INTEGRATION_EMAIL` and `FITATU_INTEGRATION_PASSWORD`.
- Integration tests may create, update, or remove data in that dedicated test account.
- Treat integration test execution as a potentially state-changing operation.
- Keep secrets, captured private responses, and personal data out of fixtures and committed test artifacts.
- Prefer the narrowest relevant verification first, then broader checks when proportionate to the change.
