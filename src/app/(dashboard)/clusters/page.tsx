'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Mock cluster data - in production this would come from an API
const mockClusters = [
  {
    id: '1',
    name: 'production-us-west-2',
    status: 'healthy',
    provider: 'AWS EKS',
    region: 'us-west-2',
    version: '1.28',
    nodes: 12,
    cpu: { used: 45, total: 100 },
    memory: { used: 62, total: 100 },
    pods: { running: 156, total: 200 },
  },
  {
    id: '2',
    name: 'staging-us-east-1',
    status: 'healthy',
    provider: 'AWS EKS',
    region: 'us-east-1',
    version: '1.28',
    nodes: 6,
    cpu: { used: 32, total: 100 },
    memory: { used: 48, total: 100 },
    pods: { running: 78, total: 120 },
  },
  {
    id: '3',
    name: 'dev-cluster',
    status: 'warning',
    provider: 'GKE',
    region: 'us-central1',
    version: '1.27',
    nodes: 3,
    cpu: { used: 78, total: 100 },
    memory: { used: 85, total: 100 },
    pods: { running: 45, total: 50 },
  },
];

export default function ClustersPage() {
  const healthyCount = mockClusters.filter((c) => c.status === 'healthy').length;
  const warningCount = mockClusters.filter((c) => c.status === 'warning').length;
  const totalNodes = mockClusters.reduce((acc, c) => acc + c.nodes, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Warning</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clusters</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Monitor and manage your Kubernetes clusters
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Demo Mode</AlertTitle>
        <AlertDescription>
          Showing mock cluster data. Connect to your Kubernetes clusters to see real data.
        </AlertDescription>
      </Alert>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clusters</CardDescription>
            <CardTitle className="text-2xl">{mockClusters.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Healthy
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{healthyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warning
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{warningCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Nodes</CardDescription>
            <CardTitle className="text-2xl">{totalNodes}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Cluster List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockClusters.map((cluster) => (
          <Card key={cluster.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(cluster.status)}
                  <div>
                    <CardTitle className="text-lg">{cluster.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{cluster.provider}</Badge>
                      <span>{cluster.region}</span>
                      <span>v{cluster.version}</span>
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(cluster.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CPU */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Cpu className="h-4 w-4" />
                    CPU
                  </span>
                  <span>{cluster.cpu.used}%</span>
                </div>
                <ProgressBar
                  value={cluster.cpu.used}
                  max={cluster.cpu.total}
                  color={cluster.cpu.used > 80 ? 'bg-red-500' : cluster.cpu.used > 60 ? 'bg-yellow-500' : 'bg-green-500'}
                />
              </div>

              {/* Memory */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <MemoryStick className="h-4 w-4" />
                    Memory
                  </span>
                  <span>{cluster.memory.used}%</span>
                </div>
                <ProgressBar
                  value={cluster.memory.used}
                  max={cluster.memory.total}
                  color={cluster.memory.used > 80 ? 'bg-red-500' : cluster.memory.used > 60 ? 'bg-yellow-500' : 'bg-green-500'}
                />
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between pt-2 border-t text-sm">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Server className="h-4 w-4" />
                  <span>{cluster.nodes} nodes</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <HardDrive className="h-4 w-4" />
                  <span>{cluster.pods.running}/{cluster.pods.total} pods</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Network className="h-4 w-4" />
                  <span>Connected</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
