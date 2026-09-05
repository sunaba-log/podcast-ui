import { AccountSettings } from "@/components/AccountSettings";
import { requireRegisteredUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireRegisteredUser();
  return (
    <AccountSettings
      email={user.email}
      displayName={user.displayName ?? ""}
    />
  );
}
