import { cn } from '@/lib/utils';

interface StatusCardProps {
  label: string;
  value: number;
  total: number;
  color: 'green' | 'orange' | 'red' | 'blue' | 'gray';
}

export function StatusCard({ label, value, total, color }: StatusCardProps) {
  const percentage = Math.round((value / total) * 100);

  const colorClasses = {
    green: 'bg-rl-green',
    orange: 'bg-rl-orange',
    red: 'bg-red-500',
    blue: 'bg-rl-blue',
    gray: 'bg-gray-400',
  };

  const textColorClasses = {
    green: 'text-rl-green',
    orange: 'text-rl-orange',
    red: 'text-red-500',
    blue: 'text-rl-blue',
    gray: 'text-gray-500',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', textColorClasses[color])}>
          {value}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
