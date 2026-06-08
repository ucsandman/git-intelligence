# Living Code Opportunities

Deferred opportunities from the self-healing control-loop pass.

## P1 - Action Outcome Learning

Use action history to tune future planner scores. Successful templates should gain confidence for similar state reports; failed or rejected templates should decay unless their failure reason has been resolved.

Rationale: the action engine now records enough history to close the loop, but planner scoring still relies on static triggers and risk penalties.

## P1 - Doctor-Guided Remediation Recipes

Let `giti doctor` explain why its top recommendation was selected and point to the relevant `giti actions show <id>` or artifact path when history exists.

Rationale: users get a diagnosis and action inspection separately today; connecting them would make the next safe step easier to trust.

## P2 - Observatory Action Filtering

Add filtering in the observatory self-healing lane by status, template id, and artifact presence.

Rationale: the current lane is intentionally compact. Filtering will matter once action history contains dozens of instances.

## P2 - Generated Artifact Forensics

Create a richer read-only report for generated-output pollution that lists exact ignored directories, offending paths, and the sensor that reported each path.

Rationale: phase 1 prevents future pollution, but older reports can still contain noisy historical signals.

## P3 - Human Approval Queue

Add a public read-only queue for medium-risk action proposals that need explicit approval before execution.

Rationale: the action system is intentionally limited to read-only and low-risk execution. A queue would let the system propose stronger repairs without silently crossing the safety boundary.
