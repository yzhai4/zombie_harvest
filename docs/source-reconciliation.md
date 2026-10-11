# Source reconciliation

This repository and the hosted game can advance on separate release lines. A hosted release must keep its source baseline identifiable before repository changes are proposed.

## Working rules

1. Start from a named repository commit or branch.
2. Record the hosted release line separately.
3. Compare runtime contracts before copying files between lines.
4. Preserve save migrations, replay fixtures, and night-state guards.
5. Run content validation, replay checks, and the three-day smoke before review.
6. Open a pull request before changing the repository default branch or preparing a hosted release.
7. Keep the release decision in the pull request and update the roadmap after it is made.

## Review checklist

- [ ] Event definitions and choices use the unified contract.
- [ ] Effects and gates are validated at runtime.
- [ ] Save migration is backward compatible.
- [ ] Replay output is deterministic.
- [ ] Night input and context interactions remain guarded.
- [ ] The release baseline is recorded in the change description.
