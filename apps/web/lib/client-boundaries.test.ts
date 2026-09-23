import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps UI entry points on the shared backend path", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../../mobile/src/screens/WeeklyPlanScreen.tsx", import.meta.url), "utf8");
  for (const source of [page, screen]) {
    expect(source).not.toMatch(/buildMockPlanningContext|planWeek\(|@trainiq\/recommendation|@trainiq\/domain/);
    expect(source).toContain("planning.getWeeklyPlan");
  }
  expect(page).toContain("await connection()");
  expect(page).toContain("createCaller");
  expect(page).not.toContain("fetch(");
});
