# OpenClaw Self-Learning

`openclaw-selflearning` is an OpenClaw extension that turns completed work into reusable assets.

It is designed to borrow the strongest ideas from learning-loop plugins and Hermes-style self-improvement systems:

- selective post-turn review
- durable memory capture
- reusable skill generation
- patching existing skills instead of endlessly cloning them
- evolution traces that track whether recalled assets actually helped
- exportable learning bundles that can be migrated across environments

## Status

This project is under active development. The current implementation target is a production-quality MVP:

- OpenClaw-native plugin entry
- per-agent learning stores
- strict JSON review worker
- candidate and promoted asset lifecycle
- explicit user-requested skill learning
- basic export/import for learning bundles

## Core Capabilities

- **Selective post-turn review**
  Only complex or unstable turns enter the learning pipeline.

- **Three-part long-term memory model**
  Facts belong in memory, reusable methods belong in skills, and historical task context stays in transcripts.

- **Patch-over-clone skill evolution**
  New observations can update an existing skill instead of always creating a new one.

- **Explicit user-requested learning**
  Users can ask the system to turn the current conversation or an SOP file into a candidate skill.

- **User revision flow**
  Candidate skills can be reviewed, revised, approved, rejected, and promoted.

- **Migration-ready learning bundles**
  Promoted learning assets can be exported and imported across environments.

## Plugin Surface

The plugin registers:

- a `selflearning` context engine
- a `/selflearn` command surface for inspection and asset management

Current command coverage:

```text
/selflearn queue
/selflearn show <skill-slug>
/selflearn learn --from current
/selflearn learn --from file <path>
/selflearn revise <skill-slug> <feedback>
/selflearn approve <skill-slug>
/selflearn reject <skill-slug>
/selflearn keep-candidate <skill-slug>
/selflearn export [--include-candidates]
/selflearn import <bundle-path> [--mode <mode>]
```

## Development

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## Public Surface

The repository is intended to ship public code and public user-facing documentation in English.
Internal design notes and Chinese planning documents are kept out of the public release flow.

## License

This repository currently uses `Apache-2.0`.
