import "server-only";

export function authConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const appUrl = process.env.TRAINIQ_APP_URL;
  if (!url || !key || !appUrl) {
    throw new Error("Missing TrainIQ Auth configuration.");
  }
  const project = new URL(url);
  const app = new URL(appUrl);
  if (
    project.protocol !== "https:" ||
    project.pathname !== "/" ||
    project.search ||
    project.hash ||
    app.pathname !== "/" ||
    app.search ||
    app.hash ||
    app.username ||
    app.password ||
    project.username ||
    project.password ||
    !key.startsWith("sb_publishable_")
  ) {
    throw new Error("Invalid TrainIQ Auth configuration.");
  }
  const secure = process.env.NODE_ENV === "production";
  if (
    app.protocol !== "https:" &&
    (secure || app.protocol !== "http:" || app.hostname !== "localhost")
  ) {
    throw new Error(
      "TrainIQ Auth requires HTTPS, except on localhost in development."
    );
  }
  return {
    url: project.origin,
    key,
    origin: app.origin,
    secure,
    cookieName: secure ? "__Host-trainiq-auth" : "trainiq-auth",
  };
}
