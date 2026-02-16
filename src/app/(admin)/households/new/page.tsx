import { HouseholdForm } from "@/components/admin/HouseholdForm";

export default function NewHouseholdPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Add Household</h2>
      <p className="mt-1 text-sm text-gray-500">
        Create a new household record. You can add members after creation.
      </p>
      <div className="mt-6">
        <HouseholdForm />
      </div>
    </div>
  );
}
