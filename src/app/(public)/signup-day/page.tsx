import { getPublicSignupEvent } from "@/actions/signup-events";
import { NewMemberSignupForm } from "@/components/public/NewMemberSignupForm";
import { formatTime } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function SignupDayPage() {
  const event = await getPublicSignupEvent();

  if (!event) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900">
          New Member Sign-Up
        </h2>
        <p className="mt-4 text-gray-600">
          Sign-up day is not currently open. Please check back when the club
          announces the next sign-up event.
        </p>
      </div>
    );
  }

  const eventDate = new Date(event.eventDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        New Member Sign-Up Day
      </h2>

      <div className="mt-4 rounded-lg border bg-white p-6">
        <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-gray-500">Date</dt>
            <dd className="font-medium">{eventDate}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Time</dt>
            <dd className="font-medium">
              {formatTime(event.eventStartTime)} &ndash; {formatTime(event.eventEndTime)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Location</dt>
            <dd className="font-medium">{event.location}</dd>
          </div>
          {event.notes && (
            <div className="col-span-2">
              <dt className="text-gray-500">Notes</dt>
              <dd className="font-medium">{event.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900">
          New Member Registration
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Fill out the form below to register as a new member. Your application
          will be reviewed by a club officer.
        </p>
        <div className="mt-4">
          <NewMemberSignupForm />
        </div>
      </div>
    </div>
  );
}
