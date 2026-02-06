import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  valueClassName?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  valueClassName,
}: MetricCardProps) {
  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', valueClassName)}>{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-1 mt-1">
            {trend && (
              <span
                className={cn(
                  'flex items-center text-xs font-medium',
                  trend === 'up' && 'text-rl-green',
                  trend === 'down' && 'text-red-500',
                  trend === 'neutral' && 'text-muted-foreground'
                )}
              >
                {trend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                {trend === 'neutral' && <Minus className="h-3 w-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground">
                {description}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
