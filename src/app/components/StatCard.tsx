interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, change, changeType, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm text-gray-600">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className="text-3xl font-bold mb-2" style={{ color: '#0F1B2D' }}>
        {value}
      </p>
      {change && (
        <p className={`text-sm font-medium ${changeType === 'positive' ? 'text-[#10B981]' : 'text-red-500'}`}>
          {change}
        </p>
      )}
    </div>
  );
}
