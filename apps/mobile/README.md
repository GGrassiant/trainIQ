# TrainIQ mobile

React Native Community CLI app (no Expo). See the [root README](../../README.md)
for setup.

From the repository root:

```sh
pnpm --filter mobile start   # Metro
pnpm --filter mobile ios
pnpm --filter mobile android
```

iOS native dependencies are installed through Bundler-pinned CocoaPods:

```sh
cd apps/mobile
bundle install
cd ios && bundle exec pod install
```
