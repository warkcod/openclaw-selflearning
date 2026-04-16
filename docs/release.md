# Release Checklist

## Before Tagging

Run the full local verification set:

```bash
npm install
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

## Verify Public Surface

- README is current
- installation guide is current
- usage guide is current
- changelog has a release entry
- internal planning material is still ignored

## Verify Plugin Metadata

- `package.json` version is correct
- `openclaw.plugin.json` matches the intended release shape
- build output is up to date

## Verify OpenClaw Integration

Recommended local smoke sequence:

```bash
openclaw plugins install -l .
openclaw gateway restart
openclaw plugins inspect selflearning
```

Then exercise:

- `/selflearn queue`
- `/selflearn learn --from current --preview`
- `/selflearn traces`

## Suggested Tagging Flow

```bash
git tag v0.1.0
git push origin main --tags
```

Adjust the version number as needed.
