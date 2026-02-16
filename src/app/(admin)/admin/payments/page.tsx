import { getPayments } from "@/actions/payments";
import { formatCurrency, formatDateTimeET } from "@/lib/utils/dates";

export default async function PaymentsPage() {
  const payments = await getPayments();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
      <p className="mt-1 text-sm text-gray-500">
        All payment transactions (online and in-person).
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Household
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 font-medium text-gray-500">Method</th>
              <th className="px-4 py-3 font-medium text-gray-500">Check #</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Recorded By
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">
                  {p.paidAt
                    ? formatDateTimeET(p.paidAt)
                    : formatDateTimeET(p.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium">
                  {p.householdName ?? "—"}
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatCurrency(p.amountCents)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      p.method === "STRIPE"
                        ? "bg-purple-100 text-purple-700"
                        : p.method === "CASH"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {p.method}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.checkNumber ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      p.status === "SUCCEEDED"
                        ? "bg-green-100 text-green-700"
                        : p.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.recordedByName ?? (p.method === "STRIPE" ? "Online" : "—")}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
