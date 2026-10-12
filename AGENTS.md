# Engineering guidelines

TrainIQ is a pnpm monorepo with two apps:

- `apps/web` — Next.js (it has its own `AGENTS.md` for Next-specific notes).
- `apps/mobile` — React Native Community CLI, no Expo.

There are no shared packages. Create one only when real duplication between
Web and Mobile exists.

## Core rule

Add complexity only when an existing, concrete problem requires it.

The product is rebuilt one vertical slice at a time. Don't design for
hypothetical future requirements: no anticipated layers, packages, API
contracts, providers or feature folders. An abstraction has to earn its place.

## Repository constraints

- Use pnpm (version pinned in the root `package.json`).
- `.npmrc` sets `node-linker=hoisted`: React Native autolinking and the iOS
  Podfile resolve dependencies from the root `node_modules`. Metro watches the
  workspace root for the same reason.
- iOS native dependencies use the CocoaPods version pinned through Bundler
  (`bundle exec pod install` in `apps/mobile/ios`).
- Do not commit, push, create tags, or rewrite Git history unless explicitly requested in the current turn.
- Never commit secrets or `.env*` files.

## Application architecture

Keep application code business-oriented and idiomatic: a reader should
primarily need to understand TrainIQ, not an internal framework built around it.

- Prefer simple React and platform-native patterns over custom infrastructure.
  Generic concerns (fetching, caching, state, formatting, localization,
  validation, serialization) use established libraries or platform primitives.
- Create services or adapters only to isolate real external-system complexity
  or domain-specific behavior, never just to add a layer.
- Keep API and domain data locale-neutral. Localize only in the presentation
  layer, using an explicit locale.

## Code style

Prefer idiomatic, readable TypeScript over cleverness.

- Prefer declarative array operations (`map`, `filter`, `find`, `some`,
  `every`) when they are clearer than a loop; keep a `for` loop when it reads
  better or needs early exit.
- Avoid nested ternaries and clever one-liners. Prefer early returns and
  well-named intermediate variables.
- Keep business rules visible rather than hiding them behind abstractions.
- Page and component files handle orchestration and rendering; reusable
  helpers such as formatters live outside them.
- Prefer clear names over comments. Comment only non-obvious external
  constraints (API conventions, framework requirements), never to narrate code.
- When an external API is integrated, keep its raw types separate from
  TrainIQ's own types and translate between them explicitly.

## Testing

- Test observable behavior, not implementation details.
- When fixing a bug, add a regression test that would have caught it.
- Don't weaken assertions to make a test pass.
- Mock only external boundaries (HTTP, native modules), not internal code.

## General principle

Optimize for code another engineer can quickly understand, review, change and
defend. When several implementations are correct, prefer the boring and
obvious one.
