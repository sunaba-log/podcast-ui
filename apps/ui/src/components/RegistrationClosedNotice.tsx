import { PRE_REGISTRATION_REQUIRED_MESSAGE } from "@/server/registration-gate";

export function RegistrationClosedNotice({
  email,
  contactEmail,
}: {
  email: string;
  contactEmail: string;
}) {
  return (
    <div className="border border-brand rounded-xs p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900">ユーザ登録</h1>
      <p className="mt-2 text-sm text-gray-500">
        {email} でサインインしています。
      </p>
      <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 space-y-2">
        <p className="text-sm text-yellow-800">
          {PRE_REGISTRATION_REQUIRED_MESSAGE}
        </p>
        <p className="text-sm">
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-brand underline hover:text-brand-hover"
          >
            {contactEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
