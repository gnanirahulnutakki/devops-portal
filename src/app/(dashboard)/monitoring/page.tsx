'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Gauge, BellRing, Logs, ChartNoAxesColumn } from 'lucide-react';

export default function MonitoringLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground">
          Jump into Grafana dashboards, alerting, and Loki logs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Grafana Dashboards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Browse dashboards and open the full Grafana UI inside the portal to view and edit.
            </p>
            <Button asChild>
              <Link href="/monitoring/grafana/dashboards">
                Open <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Grafana Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              List alert rules and open them in Grafana for full editing and history.
            </p>
            <Button asChild>
              <Link href="/monitoring/grafana/alerts">
                Open <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartNoAxesColumn className="h-5 w-5" />
              Alert Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              See noisy alerts, the 10 most recent alert events, and trends over time.
            </p>
            <Button asChild>
              <Link href="/monitoring/grafana/insights">
                Open <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Logs className="h-5 w-5" />
              Loki Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If Loki is configured in Grafana, open Explore in the portal and query logs.
            </p>
            <Button asChild>
              <Link href="/monitoring/loki">
                Open <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

