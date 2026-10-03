"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError, apiFetch, SESSION_COOKIE } from "@/lib/api";
import { HOME } from "@/lib/session";
import type { User } from "@/lib/types";

export type LoginState = { error: string | null; username: string };

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password.", username };
  let result: { token: string; user: User };
  try {
    result = await apiFetch("/auth/login", { method: "POST", body: { username, password }, token: null });
  } catch (e) {
    const message = e instanceof ApiError && e.status === 401 ? "That username and password don't match an account." : (e as Error).message;
    return { error: message, username };
  }
  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  redirect(HOME[result.user.role]);
}

export async function signOut() {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)) {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    jar.delete(SESSION_COOKIE);
  }
  redirect("/login");
}

export async function decideFlag(flagId: number, _prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const status = String(form.get("status") ?? "");
  const note = String(form.get("note") ?? "");
  try {
    await apiFetch(`/ops/flags/${flagId}/decision`, { method: "POST", body: { status, note } });
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/operations/flags/${flagId}?saved=1`);
}

export async function runDetection() {
  await apiFetch("/ops/detection/run", { method: "POST", body: {} });
  redirect("/operations?detected=1");
}
