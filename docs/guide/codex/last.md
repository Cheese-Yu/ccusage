# Codex Last N Days Report (Beta)

The `last` command shows daily Codex usage for the most recent **N complete days**, excluding today.

```bash
# Last 7 days by default (excluding today)
npx @ccusage/codex@latest last

# Last 10 days (excluding today)
npx @ccusage/codex@latest last --day 10
```

## Options

| Flag                         | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| `--day`                      | Optional positive integer. Number of days to include (default: 7) |
| `--timezone`                 | Override timezone used for grouping (defaults to system)          |
| `--locale`                   | Adjust date formatting locale                                     |
| `--json`                     | Emit structured JSON instead of a table                           |
| `--offline` / `--no-offline` | Force cached LiteLLM pricing or enable live fetching              |
| `--compact`                  | Force compact table layout (same columns as a narrow terminal)    |
