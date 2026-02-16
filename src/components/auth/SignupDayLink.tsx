import { getPublicSignupEvent } from "@/actions/signup-events";
import Link from "next/link";

/**
 * Async server component that checks if a public signup event is active.
 * If active, renders a link to the signup-day page.
 */
export async function SignupDayLink() {
  const event = await getPublicSignupEvent();

  if (!event) return null;

  return (
    <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-center">
      <p className="text-sm text-green-800">
        New member?{" "}
        <Link
          href="/signup-day"
          className="font-medium text-green-700 underline hover:text-green-900"
        >
          Apply for membership &rarr;
        </Link>
      </p>
    </div>
  );
}
