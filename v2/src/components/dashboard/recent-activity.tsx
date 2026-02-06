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

interface ActivityItem {
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

// Mock data - replace with actual data fetching
const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'sync_success',
    title: 'rli-use2-mp02 synced',
    description: 'Application synced successfully',
    user: { name: 'ArgoCD' },
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: '2',
    type: 'pr_merged',
    title: 'Update FID version to 8.1.2',
    description: 'Merged by developer1 into master',
    user: { name: 'developer1', avatar: 'https://github.com/identicons/dev1.png' },
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: '3',
    type: 'deployment',
    title: 'Production deployment',
    description: 'rli-use2-jb01 deployed v1.0.1',
    user: { name: 'Jenkins' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: '4',
    type: 'alert',
    title: 'High CPU usage detected',
    description: 'rli-use2-mp04: CPU > 80% for 5 minutes',
    user: { name: 'Prometheus' },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: '5',
    type: 'pr_opened',
    title: 'Fix nodeSelector configuration',
    description: 'Opened by developer2',
    user: { name: 'developer2', avatar: 'https://github.com/identicons/dev2.png' },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];

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

export async function RecentActivity() {
  // In production, fetch from API
  const activities = mockActivities;

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
