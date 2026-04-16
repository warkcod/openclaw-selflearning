# Usage

## Mental Model

The plugin manages three long-term asset classes:

- **Memory**: durable facts and preferences
- **Transcript recall**: historical decision or debugging context
- **Skills**: reusable procedures and workflows

## Quick Start

Open a normal OpenClaw conversation surface and try:

```text
/selflearn queue
/selflearn memories
/selflearn transcripts
/selflearn traces
```

## Explicit Skill Learning

Learn from the current scoped conversation:

```text
/selflearn learn --from current
```

Learn from the last task-like turn block:

```text
/selflearn learn --from last-task
```

Learn from the last N user turns:

```text
/selflearn learn --from recent-turns 2
```

Learn from a manually marked range:

```text
/selflearn mark-start
...continue the workflow...
/selflearn mark-end
/selflearn learn --from marked
```

Learn from a file:

```text
/selflearn learn --from file /absolute/path/to/sop.md
```

## Preview Before Learning

Use `--preview` to inspect the learning range before generating a skill:

```text
/selflearn learn --from recent-turns 2 --preview
/selflearn learn --from marked --preview
```

## Review and Governance

Show a skill:

```text
/selflearn show <skill-slug>
```

Revise a skill:

```text
/selflearn revise <skill-slug> <feedback>
```

Approve or reject:

```text
/selflearn approve <skill-slug>
/selflearn reject <skill-slug>
/selflearn keep-candidate <skill-slug>
```

Memory governance:

```text
/selflearn approve-memory <memory-id>
/selflearn reject-memory <memory-id>
/selflearn keep-memory <memory-id>
```

Transcript governance:

```text
/selflearn approve-transcript <transcript-id>
```

## Patch Proposal Workflows

List patch proposals:

```text
/selflearn patches
```

Apply or reject:

```text
/selflearn apply-patch <proposal-id>
/selflearn reject-patch <proposal-id>
```

## Lifecycle Controls

Manual suppression:

```text
/selflearn suppress <skill-slug>
```

Manual re-promotion:

```text
/selflearn repromote <skill-slug>
```

## Evolution Trace Inspection

List recent traces:

```text
/selflearn traces
```

Inspect one trace:

```text
/selflearn trace <trace-id>
```

## Bundles

Export:

```text
/selflearn export
/selflearn export --include-candidates
```

Import:

```text
/selflearn import /path/to/bundle.json --mode preserve_origin_agent --on-conflict prefer_incoming
```

Supported import modes:

- `rebind_to_current_agent`
- `preserve_origin_agent`
- `merge_into_user_profile`

Supported conflict strategies:

- `preserve_versions`
- `prefer_incoming`
- `prefer_existing`
