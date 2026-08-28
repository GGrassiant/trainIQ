import type { AppEnvironment } from "@trainiq/types";

const env: AppEnvironment = {
  appName: "TrainIQ",
  isMonorepoConfigured: true,
};

export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>{env.appName}</h1>
      <p>Monorepo configured: {String(env.isMonorepoConfigured)}</p>
    </main>
  );
}
