# giti Telemetry

## What We Collect

giti can optionally collect anonymous usage data to help the tool improve itself.

### Data Points
- Which command was run (pulse, hotspots, ghosts)
- Which flags were used (e.g., --json, --since=30d)
- How long the command took to execute
- Whether it succeeded or failed (error class name only, never the message)
- General repo characteristics (commit count bucket, not exact numbers)
- OS platform (darwin, linux, win32) and Node.js version
- giti version

### What We NEVER Collect
- Repository names, URLs, or file paths
- Commit messages, branch names, or author information
- File contents or code
- Anything that could identify you or your project
- IP addresses

## How to Control It

giti asks once on first run. You can change your preference anytime:

- `giti telemetry on` — enable collection
- `giti telemetry off` — disable collection
- `giti telemetry status` — check current setting
- `giti telemetry show` — see exactly what's been collected
- `giti telemetry clear` — delete all collected data

## How It's Used

The telemetry data stays on your machine. giti's Growth Hormone agent
reads it locally to understand usage patterns and propose improvements.
No data is transmitted anywhere.

## Why It Matters

giti is a living codebase — it evolves autonomously. Telemetry is how
it learns what you actually need versus what it thinks you need.
Without telemetry, it evolves blind. With it, every improvement is
grounded in real usage.
