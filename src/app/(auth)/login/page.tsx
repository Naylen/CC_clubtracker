import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupDayLink } from "@/components/auth/SignupDayLink";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-green-800">MCFGC</h1>
          <p className="mt-1 text-sm text-gray-500">Admin Sign In</p>
        </div>

        <LoginForm />

        <Suspense fallback={null}>
          <SignupDayLink />
        </Suspense>

        <p className="mt-4 text-center text-xs text-gray-400">
          Montgomery County Fish & Game Club
        </p>
      </div>
    </div>
  );
}
