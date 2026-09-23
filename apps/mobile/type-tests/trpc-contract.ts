import type { WeeklyPlan } from '@trainiq/types';
import type { trpc } from '../src/api/trpc';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Assert<T extends true> = T;
type Planning = typeof trpc.planning;
type Query = Planning['getWeeklyPlan']['query'];

// Compiled by the mobile typecheck; no runtime calls or Jest execution.
export type WeeklyPlanOutput = Assert<
  Equal<Awaited<ReturnType<Query>>, WeeklyPlan>
>;
export type NoInput = Assert<Equal<Parameters<Query>[0], void | undefined>>;
export type CallableWithoutInput = Assert<
  [] extends Parameters<Query> ? true : false
>;
export type UnknownProcedureRejected = Assert<
  Equal<'nope' extends keyof Planning ? true : false, false>
>;

export async function assertQueryContract(query: Query) {
  const plan = await query();

  // @ts-expect-error The inferred output must not accept a numeric date, even via any.
  const invalidPlan: { weekStartDate: number } = plan;

  // @ts-expect-error This procedure accepts no business input.
  await query({ weekStartDate: '2026-09-21' });
  return invalidPlan;
}
