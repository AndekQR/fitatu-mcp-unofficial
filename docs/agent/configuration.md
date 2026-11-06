# Configuration

Read runtime configuration from environment variables or the repository's explicit configuration mechanism. Never hard-code or commit secrets.

When adding a configuration value, document:

- its variable name;
- whether it is required;
- its default value, if any;
- whether it is sensitive;
- its operational purpose.

Keep `.env.example`, runtime validation, and user-facing configuration documentation synchronized when applicable.
