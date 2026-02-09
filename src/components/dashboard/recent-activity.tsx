'use client';

import { formatRelativeTime } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  GitPullRequest,
  GitMerge,
  Rocket,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: 'pr_opened' | 'pr_merged' | 'deployment' | 'sync' | 'alert' | 'sync_success';
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  status?: 'success' | 'failed' | 'pending';
}

const iconMap = {
  pr_opened: GitPullRequest,
  pr_merged: GitMerge,
  deployment: Rocket,
  sync: RefreshCw,
  sync_success: CheckCircle2,
  alert: AlertCircle,
};

const iconColorMap = {
  pr_opened: 'text-rl-blue bg-rl-blue/10',
  pr_merged: 'text-purple-500 bg-purple-500/10',
  deployment: 'text-rl-green bg-rl-green/10',
  sync: 'text-rl-blue bg-rl-blue/10',
  sync_success: 'text-rl-green bg-rl-green/10',
  alert: 'text-rl-orange bg-rl-orange/10',
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const activities = items;

  if (activities.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = iconMap[activity.type];
        const iconColor = iconColorMap[activity.type];

        return (
          <div
            key={activity.id}
            className="flex items-start gap-4 rounded-lg p-3 hover:bg-muted/50 transition-colors"
          >
            {/* Icon */}
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{activity.title}</p>
                {activity.status && (
                  <Badge
                    variant={
                      activity.status === 'success'
                        ? 'default'
                        : activity.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-xs"
                  >
                    {activity.status}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {activity.description}
              </p>
            </div>

            {/* User & Time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Avatar className="h-6 w-6">
                <AvatarImage src={activity.user.avatar} />
                <AvatarFallback className="text-xs">
                  {activity.user.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">{formatRelativeTime(activity.timestamp)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
