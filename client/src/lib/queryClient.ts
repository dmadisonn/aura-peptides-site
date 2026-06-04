import { QueryClient, QueryFunction } from "@tanstack/react-query";

const ADMIN_TOKEN_KEY = "aura_admin_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { "x-admin-token": token } : {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { ...getAuthHeaders() };
  if (data) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  return res;
}

export const getQueryFn = (options?: { on401?: string }): QueryFunction => async ({ queryKey }) => {
  try {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      if (options?.on401 === "returnNull") return null;
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
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
