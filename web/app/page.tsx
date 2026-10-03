import { redirect } from "next/navigation";

import { getUser, HOME } from "@/lib/session";

export default async function Home() {
  const user = await getUser();
  redirect(user ? HOME[user.role] : "/login");
}
