'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

// Mock alerts data
const mockAlerts = [
  {
    id: '1',
    title: 'High CPU usage detected',
    message: 'rli-use2-mp04: CPU > 80% for 5 minutes',
    severity: 'warning',
    status: 'active',
    source: 'Prometheus',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: '2',
    title: 'Pod restart detected',
    message: 'fid-0 in namespace customer-prod restarted 3 times',
    severity: 'error',
    status: 'active',
    source: 'Kubernetes',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: '3',
    title: 'Deployment out of sync',
    message: 'argocd-app-prod is out of sync with Git',
    severity: 'info',
    status: 'active',
    source: 'ArgoCD',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
  {
    id: '4',
    title: 'Memory threshold exceeded',
    message: 'staging-cluster node memory above 90%',
    severity: 'error',
    status: 'resolved',
    source: 'Prometheus',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    acknowledged: true,
    resolvedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    title: 'SSL certificate expiring',
    message: 'api.example.com certificate expires in 7 days',
    severity: 'warning',
    status: 'active',
    source: 'Cert Manager',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts);

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const resolvedAlerts = alerts.filter((a) => a.status === 'resolved');
  const criticalCount = alerts.filter((a) => a.severity === 'error' && a.status === 'active').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning' && a.status === 'active').length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Warning</Badge>;
      case 'info':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Info</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (hours > 24) {
      return date.toLocaleDateString();
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      return `${minutes}m ago`;
    }
  };

  const toggleAcknowledge = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, acknowledged: !a.acknowledged } : a)));
  };

  const AlertList = ({ alertList }: { alertList: typeof alerts }) => {
    if (alertList.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No alerts</p>
          <p className="text-sm mt-1">All systems are operating normally</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {alertList.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
              alert.acknowledged
                ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
          >
            {getSeverityIcon(alert.severity)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium ${alert.acknowledged ? 'text-gray-500' : ''}`}>
                  {alert.title}
                </span>
                {getSeverityBadge(alert.severity)}
                <Badge variant="outline" className="text-xs">
                  {alert.source}
                </Badge>
                {alert.acknowledged && (
                  <Badge variant="secondary" className="text-xs">
                    Acknowledged
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.message}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(alert.timestamp)}
                </span>
                {alert.resolvedAt && (
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Resolved {formatTimestamp(alert.resolvedAt)}
                  </span>
                )}
              </div>
            </div>
            {alert.status === 'active' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleAcknowledge(alert.id)}
                className="shrink-0"
              >
                {alert.acknowledged ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and respond to system alerts
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Alerts</CardDescription>
            <CardTitle className="text-2xl">{activeAlerts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Critical
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">{criticalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warnings
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{warningCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Resolved (24h)
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{resolvedAlerts.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            All Alerts
          </CardTitle>
          <CardDescription>System alerts from all sources</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Active ({activeAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Resolved ({resolvedAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                All ({alerts.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <AlertList alertList={activeAlerts} />
            </TabsContent>
            <TabsContent value="resolved">
              <AlertList alertList={resolvedAlerts} />
            </TabsContent>
            <TabsContent value="all">
              <AlertList alertList={alerts} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
