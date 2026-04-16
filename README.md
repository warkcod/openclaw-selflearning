# OpenClaw Self-Learning

[![CI](https://github.com/warkcod/openclaw-selflearning/actions/workflows/ci.yml/badge.svg)](https://github.com/warkcod/openclaw-selflearning/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/warkcod/openclaw-selflearning)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-blue)](https://github.com/openclaw/openclaw)

`openclaw-selflearning` is an OpenClaw extension that turns completed work into reusable assets.

It borrows the strongest ideas from learning-loop plugins and Hermes-style self-improvement systems:

- selective post-turn review
- durable memory capture
- transcript recall as a separate long-term asset
- reusable skill generation
- patch-over-clone skill evolution
- evolution traces that track whether recalled assets actually helped
- exportable learning bundles that can be migrated across environments

## Why This Exists

Most agent memory systems remember facts, but they do not reliably improve how the agent works.

This extension is designed to help OpenClaw agents accumulate reusable operational knowledge over time:

- stable facts become memory
- historical decision context becomes transcript recall
- repeatable workflows become skills

Those assets are then recalled, governed, revised, suppressed, re-promoted, and migrated over time.

## Core Capabilities

- **Selective post-turn review**
  Only complex or unstable turns enter the learning pipeline.

- **Three-part long-term memory model**
  Facts belong in memory, historical task context belongs in transcript recall, and reusable procedures belong in skills.

- **Patch-over-clone skill evolution**
  New observations can update an existing skill instead of always creating a new one.

- **Explicit user-requested learning**
  Users can ask the system to turn the current conversation, a marked range, recent turns, or an SOP file into a candidate skill.

- **Governance workflows**
  Candidate skills, memories, transcript recalls, and patch proposals can be reviewed and promoted deliberately.

- **Lifecycle policies**
  Assets can become stale, be suppressed after repeated user corrections, and be re-promoted after later success.

- **Migration-ready bundles**
  Learned assets can be exported and imported across environments.

## Plugin Surface

The plugin registers:

- a `selflearning` context engine
- a `/selflearn` command surface for learning, review, and asset management

Current command coverage includes:

```text
/selflearn queue
/selflearn memories
/selflearn transcripts
/selflearn traces
/selflearn trace <trace-id>
/selflearn show <skill-slug>
/selflearn patches
/selflearn mark-start
/selflearn mark-end
/selflearn learn --from current [--preview]
/selflearn learn --from last-task [--preview]
/selflearn learn --from recent-turns <n> [--preview]
/selflearn learn --from marked [--preview]
/selflearn learn --from file <path>
/selflearn revise <skill-slug> <feedback>
/selflearn apply-patch <proposal-id>
/selflearn reject-patch <proposal-id>
/selflearn approve <skill-slug>
/selflearn approve-memory <memory-id>
/selflearn approve-transcript <transcript-id>
/selflearn reject-memory <memory-id>
/selflearn keep-memory <memory-id>
/selflearn reject <skill-slug>
/selflearn suppress <skill-slug>
/selflearn repromote <skill-slug>
/selflearn keep-candidate <skill-slug>
/selflearn export [--include-candidates]
/selflearn import <bundle-path> [--mode <mode>] [--on-conflict <mode>]
```

## Installation

See [docs/installation.md](docs/installation.md) for step-by-step local installation into an existing OpenClaw setup.

## Usage

See [docs/usage.md](docs/usage.md) for practical examples, learning-range selection, governance commands, and bundle migration workflows.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

For release verification:

```bash
npm pack --dry-run
```

## Project Status

This repository is under active development, but the current implementation already includes:

- OpenClaw-native plugin entry
- per-agent learning stores
- strict JSON review worker
- candidate and promoted asset lifecycle
- explicit user-requested learning
- transcript recall
- patch proposal governance
- import and export flows
- host-loader smoke and host-runtime integration tests

## Roadmap

Near-term priorities:

- public docs hardening
- CI and release automation
- richer lifecycle policy tuning
- deeper transcript recall quality heuristics

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

This project is licensed under [Apache-2.0](LICENSE).

## Links

- Repository: https://github.com/warkcod/openclaw-selflearning
- Issues: https://github.com/warkcod/openclaw-selflearning/issues
