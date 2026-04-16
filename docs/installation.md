# Installation

## Install Into an Existing OpenClaw Setup

From this repository root:

```bash
npm install
npm run build
openclaw plugins install -l .
openclaw gateway restart
```

That links the plugin into your current OpenClaw profile and reloads the gateway.

## Verify the Plugin Loaded

Check plugin status:

```bash
openclaw plugins inspect selflearning
```

Expected signals:

- `Status: loaded`
- `Commands: selflearn`
- `Capabilities: context-engine: selflearning`

You can also list installed plugins:

```bash
openclaw plugins list
```

## Verify the Command Surface

In a normal OpenClaw conversation surface such as:

- `openclaw tui`
- Telegram
- Feishu

send:

```text
/selflearn queue
```

If the plugin is active, OpenClaw should respond with either candidate entries or `No candidate skills.`

## Verify Context-Engine Activation

The installer switches the `contextEngine` slot to `selflearning`. To confirm:

```bash
openclaw plugins inspect selflearning
```

or inspect your config file:

```bash
openclaw config file
```

Look for:

```json
"plugins": {
  "slots": {
    "contextEngine": "selflearning"
  }
}
```

## Update After Local Changes

If you change source files locally:

```bash
npm run build
openclaw gateway restart
```

Because the plugin is installed by linked path, a rebuild plus gateway restart is enough.
