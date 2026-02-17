"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signupNewMember } from "@/actions/signup-events";
import { signIn } from "@/lib/auth-client";
import { US_STATES } from "@/lib/utils/us-states";

export function NewMemberSignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVeteran, setIsVeteran] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Validate password
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);

    // Append password to FormData (not a native form field to avoid browser autofill issues)
    formData.set("password", password);

    // Validate veteran doc if veteran is checked
    if (isVeteran) {
      const veteranDoc = formData.get("veteranDoc") as File | null;
      if (!veteranDoc || veteranDoc.size === 0) {
        setError("Please upload proof of disabled veteran status.");
        setLoading(false);
        return;
      }
      if (veteranDoc.size > 5 * 1024 * 1024) {
        setError("Veteran document must be under 5MB.");
        setLoading(false);
        return;
      }
    }

    const result = await signupNewMember(formData);

    if (result.success) {
      // Auto-login and redirect to member portal
      try {
        await signIn.email({
          email: result.data.email,
          password,
        });
        router.push("/member/dashboard");
        return;
      } catch {
        // If auto-login fails, show success with login link
        setLoading(false);
        setSuccess(true);
      }
    } else {
      setLoading(false);
      setError(result.error);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border bg-green-50 p-8 text-center">
        <h3 className="text-lg font-semibold text-green-800">
          Registration Submitted!
        </h3>
        <p className="mt-2 text-sm text-green-700">
          Thank you for registering. Your application is pending review by a
          club officer. You can check your application status by{" "}
          <a href="/login" className="font-medium underline">
            logging in
          </a>{" "}
          to your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-gray-900">
          Your Information
        </legend>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <input
              name="firstName"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Last Name
            </label>
            <input
              name="lastName"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Date of Birth
          </label>
          <input
            name="dateOfBirth"
            type="date"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              DL State
            </label>
            <select
              name="driverLicenseState"
              defaultValue="KY"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Driver License Number
            </label>
            <input
              name="driverLicense"
              required
              placeholder="e.g. K12-345-678"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Required for membership verification. This information is encrypted
          and stored securely.
        </p>

        <div className="flex items-center gap-2">
          <input
            name="isVeteranDisabled"
            type="checkbox"
            checked={isVeteran}
            onChange={(e) => setIsVeteran(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label className="text-sm font-medium text-gray-700">
            Disabled Veteran (discount eligible)
          </label>
        </div>

        {isVeteran && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <label className="block text-sm font-medium text-green-800">
              Upload Proof of Disabled Veteran Status
            </label>
            <p className="mt-1 text-xs text-green-700">
              DD-214, VA letter, or other official documentation. PDF, JPG, or
              PNG. Max 5MB.
            </p>
            <input
              name="veteranDoc"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              className="mt-2 w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-green-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-200"
            />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-gray-900">
          Create Your Account Password
        </legend>
        <p className="text-sm text-gray-500">
          Set a password so you can log in and check your application status.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-gray-900">Address</legend>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Address Line 1
          </label>
          <input
            name="addressLine1"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Address Line 2
          </label>
          <input
            name="addressLine2"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              City
            </label>
            <input
              name="city"
              defaultValue="Mt Sterling"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              State
            </label>
            <input
              name="state"
              defaultValue="KY"
              required
              maxLength={2}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              ZIP
            </label>
            <input
              name="zip"
              defaultValue="40353"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            name="phone"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-gray-900">
          Emergency Contact
        </legend>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Contact Name
          </label>
          <input
            name="emergencyContactName"
            required
            placeholder="Full name"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contact Phone
            </label>
            <input
              name="emergencyContactPhone"
              required
              placeholder="e.g. 859-555-1234"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Relationship
            </label>
            <input
              name="emergencyContactRelationship"
              required
              placeholder="e.g. Spouse, Parent"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-green-700 px-4 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Registration"}
      </button>
    </form>
  );
}
