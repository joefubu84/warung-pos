import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createAuthState } from "./lib/auth-state";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const auth = createAuthState();

  const router = createRouter({
    routeTree,
    context: { queryClient, auth },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
