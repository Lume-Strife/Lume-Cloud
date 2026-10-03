import { ApiError, apiFetch } from "@/lib/api";

/** Streams the compliance CSV through the server so the session token stays in its httpOnly cookie. */
export async function GET() {
  let res: Response;
  try {
    res = await apiFetch<Response>("/regulator/compliance.csv", { raw: true });
  } catch (e) {
    if (e instanceof ApiError) return new Response(e.message, { status: e.status });
    throw e;
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="feeder-compliance.csv"',
    },
  });
}
