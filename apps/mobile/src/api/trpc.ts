import { createTRPCClient, httpLink } from '@trpc/client';
import type { AppRouter } from '../../../web/trpc-types';
import { BACKEND_URL } from '../config/backend';

export const trpc = createTRPCClient<AppRouter>({
  links: [httpLink({ url: `${BACKEND_URL}/api/trpc` })],
});
