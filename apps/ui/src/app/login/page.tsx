import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionUser } from "@/server/auth";
import { isGuestModeEnabled } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/episodes");
  return <LoginForm guestEnabled={isGuestModeEnabled()} />;
}
