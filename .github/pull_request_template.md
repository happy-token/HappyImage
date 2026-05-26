## Summary

- 

## Verification

- [ ] `bun run build:core`
- [ ] `bun run build:web`
- [ ] `bun run build:cli`
- [ ] `bunx tsc -p packages/desktop/tsconfig.json --noEmit`
- [ ] `bun test packages/desktop/tests/sidecar.test.ts packages/desktop/tests/lifecycle.test.ts packages/desktop/tests/preload.test.ts`

## Release Impact

- [ ] No npm package changes
- [ ] No desktop packaging changes
- [ ] Requires npm package publish
- [ ] Requires desktop release
