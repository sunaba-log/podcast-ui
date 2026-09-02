import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/RegisterForm";
import { RegistrationClosedNotice } from "@/components/RegistrationClosedNotice";
import { getSessionUser } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { getContactEmail } from "@/server/env";
import { isRegistrationAllowed } from "@/server/registration-gate";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.registered) redirect("/episodes");
  if (!(await isRegistrationAllowed(await getDbPool(), user))) {
    return (
      <RegistrationClosedNotice
        email={user.email}
        contactEmail={getContactEmail()}
      />
    );
  }
  return (
    <RegisterForm
      email={user.email}
      defaultDisplayName={user.displayName ?? ""}
    />
  );
}
