"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Upload } from "lucide-react";

const DRAWIO_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=min&noSaveBtn=1&noExitBtn=1";

const EMPTY_DIAGRAM =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

export default function DiagramsPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const xmlRef = useRef<string>(EMPTY_DIAGRAM);

  const postToDrawio = useCallback(
    (msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify(msg),
        "*"
      );
    },
    []
  );

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (event.origin !== "https://embed.diagrams.net") return;

      let msg: any;
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (msg.event === "init") {
        setReady(true);
        const saved = localStorage.getItem("devops-portal-diagram");
        postToDrawio({
          action: "load",
          xml: saved || EMPTY_DIAGRAM,
          autosave: 1,
        });
      }

      if (msg.event === "autosave" || msg.event === "save") {
        if (msg.xml) {
          xmlRef.current = msg.xml;
          localStorage.setItem("devops-portal-diagram", msg.xml);
        }
      }

      if (msg.event === "export") {
        if (msg.data) {
          const a = document.createElement("a");
          a.href = msg.data;
          a.download = `diagram.${msg.format || "png"}`;
          a.click();
        }
      }
    }

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [postToDrawio]);

  const handleExport = useCallback(() => {
    postToDrawio({ action: "export", format: "png", spin: "Exporting..." });
  }, [postToDrawio]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".drawio,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      postToDrawio({ action: "load", xml: text, autosave: 1 });
    };
    input.click();
  }, [postToDrawio]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Diagrams
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create flow charts and architecture diagrams using draw.io.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ready && (
            <>
              <Button variant="outline" size="sm" onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Import .drawio
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export PNG
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                "https://app.diagrams.net/",
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Embedded draw.io</CardTitle>
          <CardDescription>
            Diagrams auto-save to your browser. Use Import/Export to load or
            download .drawio and PNG files.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[75vh] overflow-hidden rounded-md border">
          <iframe
            ref={iframeRef}
            title="drawio"
            src={DRAWIO_URL}
            className="h-full w-full"
            allow="clipboard-write; clipboard-read"
          />
        </CardContent>
      </Card>
    </div>
  );
}
