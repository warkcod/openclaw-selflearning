# Security Policy

## Supported Versions

This project is pre-1.0 and currently only the latest `main` branch is supported for security fixes.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for sensitive vulnerabilities.

Instead:

1. prepare a minimal description of the issue
2. include impact, affected files, and reproduction steps if safe
3. share it privately with the maintainers

If you do not yet have a private contact path, open a minimal public issue asking for a secure reporting channel without disclosing the vulnerability details.

## Scope

Security-sensitive areas include:

- plugin loading and manifest handling
- import/export of learning bundles
- review-worker prompt and parsing logic
- asset persistence and lifecycle state transitions
- any command that mutates learned assets

## Response Expectations

The project will aim to:

- acknowledge the report
- reproduce and assess impact
- prepare a fix
- disclose responsibly after a mitigation exists

No response-time guarantee is promised yet, but reports will be triaged as quickly as practical.
