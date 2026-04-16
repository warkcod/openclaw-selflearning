# Contributing

## Development Setup

Requirements:

- Node.js 22.14+ or newer
- npm
- A local checkout of OpenClaw if you want to run host-loader integration tests

Install dependencies:

```bash
npm install
```

Run the local quality checks:

```bash
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

## Project Conventions

- Public documentation must be written in English.
- Keep internal planning material out of the public repository.
- Preserve the three-part asset model:
  - memory
  - transcript recall
  - skills
- Prefer patching an existing skill over creating a duplicate candidate when the workflow is clearly the same.
- Keep lifecycle changes trace-backed whenever possible.

## Pull Requests

Every pull request should include:

- the problem being solved
- the intended behavior change
- validation performed
- any migration or compatibility notes

If the change affects asset state or import/export semantics, include an explicit note describing backward compatibility expectations.

## Commit Messages

This repository uses structured English commit messages with a short why-first subject line and trailer-style metadata in the body.

Good example:

```text
Add transcript recall as a first-class learning asset

Introduce transcript recall records alongside memory and skills so
historical decision context can be recalled without polluting the
durable fact store.

Constraint: Transcript recall must remain separate from durable memory
Rejected: Collapse transcript recall into memory entries | would blur asset roles
Confidence: high
Scope-risk: moderate
Directive: Preserve the three-part asset model in future recall work
Tested: npm run typecheck; npm run build; npm test
Not-tested: Long-horizon transcript recall quality under production traffic
```

## Testing Guidance

Tests are grouped into:

- unit tests for isolated behavior
- store tests for persistence and lifecycle state
- integration tests for plugin loading and host-runtime behavior

When adding a feature or behavior change:

1. add or update tests first
2. make the smallest implementation change that satisfies them
3. run the full local verification set before submitting
