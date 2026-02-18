"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function DiagramsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Diagrams</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create flow charts and architecture diagrams using draw.io.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open("https://app.diagrams.net/", "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Embedded draw.io</CardTitle>
          <CardDescription>
            Use the editor below. Export diagrams as PNG/SVG and attach to runbooks or tickets.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[70vh] overflow-hidden rounded-md border">
          <iframe
            title="drawio"
            src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=min&noSaveBtn=1&noExitBtn=1"
            className="h-full w-full"
            allow="clipboard-write; clipboard-read"
          />
        </CardContent>
      </Card>
    </div>
  );
}
