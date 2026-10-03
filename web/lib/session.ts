import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiFetch, SESSION_COOKIE } from "./api";
import type { Role, User } from "./types";

export const HOME: Record<Role, string> = {
  customer: "/customer",
  operations: "/operations",
  regulator: "/regulator",
};

export const getUser = cache(async (): Promise<User | null> => {
  if (!(await cookies()).get(SESSION_COOKIE)) return null;
  return apiFetch<User>("/me");
});

/** Redirects to sign-in, or to the user's own home if their role may not see this page. */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(HOME[user.role]);
  return user;
}
