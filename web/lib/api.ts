import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";
export const SESSION_COOKIE = "session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; token?: string | null; raw?: boolean };

/** Call the platform API from the server. The session token never reaches the browser. */
export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const token = opts.token === undefined ? (await cookies()).get(SESSION_COOKIE)?.value : opts.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, `The platform API is not reachable at ${API_URL}. Start it with: uvicorn src.api.main:app`);
  }
  if (res.status === 401 && token) redirect("/login?expired=1");
  if (!res.ok) {
    const detail = await res.json().then((b) => b.detail, () => res.statusText);
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return (opts.raw ? res : res.json()) as Promise<T>;
}
