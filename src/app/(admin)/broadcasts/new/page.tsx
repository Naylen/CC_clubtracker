import { BroadcastForm } from "@/components/admin/BroadcastForm";

export default function NewBroadcastPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Compose Broadcast</h2>
      <p className="mt-1 text-sm text-gray-500">
        Send an email to club members. Select a filter to target specific
        groups.
      </p>
      <div className="mt-6">
        <BroadcastForm />
      </div>
    </div>
  );
}
