# HappyImage

Visual workspace and CLI for running `baoyu-skills` content generation workflows.

## Commands

```bash
bun run build
bun run bin/happyimage.ts doctor
bun run bin/happyimage.ts web --port 3200 --open
```

After publishing as an npm package, the intended commands are:

```bash
npx happyimage web --open
npx happyimage doctor
```

## Current Scope

- Local Web UI for choosing baoyu skills without remembering slash commands.
- Natural language intake with optional local project path or GitHub URL context.
- Project-style outputs: `source`, `analysis.md`, `outline.md`, `copy.md`, `prompts/*.md`, images.
- Publish package preparation.
- WeChat, Weibo, and X browser-fill workflows through existing baoyu post skills.

## Planning

- [PRD.md](./PRD.md): original Web UI scope.
- [PRD_NEXT.md](./PRD_NEXT.md): current roadmap and agent-ready task split.

## Notes

This package currently expects to run inside, or alongside, the `baoyu-skills` workspace so it can access `skills/`.
