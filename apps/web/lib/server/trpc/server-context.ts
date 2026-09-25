import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createTRPCContext } from "./context";

export const getServerTRPCContext = cache(async () =>
  createTRPCContext(await headers())
);
