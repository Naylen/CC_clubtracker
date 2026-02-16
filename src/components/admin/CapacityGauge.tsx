interface CapacityGaugeProps {
  occupied: number;
  cap: number;
}

export function CapacityGauge({ occupied, cap }: CapacityGaugeProps) {
  const percentage = cap > 0 ? Math.round((occupied / cap) * 100) : 0;
  const available = Math.max(0, cap - occupied);

  let barColor = "bg-green-500";
  if (percentage >= 90) barColor = "bg-red-500";
  else if (percentage >= 75) barColor = "bg-yellow-500";

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Membership Capacity</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{occupied}</span>
        <span className="text-lg text-gray-500">/ {cap}</span>
      </div>
      <div className="mt-3">
        <div className="h-3 w-full rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        {available} slot{available !== 1 ? "s" : ""} available ({percentage}%
        filled)
      </p>
    </div>
  );
}
