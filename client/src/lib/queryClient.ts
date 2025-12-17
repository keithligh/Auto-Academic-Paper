import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const STORAGE_KEY = "poe_api_key";
const AI_CONFIG_KEY = "ai_config_v1";

function getAuthHeaders() {
  const aiConfig = localStorage.getItem(AI_CONFIG_KEY);
  if (aiConfig) {
    return { "X-AI-Config": aiConfig };
  }
  const key = localStorage.getItem(STORAGE_KEY);
  return key ? { "X-Poe-Api-Key": key } : {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeaders(),
  };

  const res = await fetch(url, {
    method,
    headers: headers as HeadersInit,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        headers: getAuthHeaders() as HeadersInit,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
