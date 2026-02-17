import { getMembershipYears } from "@/actions/membership-years";
import { ImportMembersForm } from "@/components/admin/ImportMembersForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const years = await getMembershipYears();

  const yearOptions = years.map((y) => ({
    id: y.id,
    year: y.year,
    capacityCap: y.capacityCap,
  }));

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Import Members</h2>
        <p className="mt-1 text-sm text-gray-500">
          Bulk import members from a CSV file into a selected membership year.
        </p>
      </div>

      <div className="mt-6 max-w-2xl">
        <ImportMembersForm membershipYears={yearOptions} />
      </div>
    </div>
  );
}
