// Command client is the MVP client CLI for TBD_PROJECT_NAME.
//
// Usage:
//
//	client get-pods [-namespace X] [-agent NAME] [-gateway URL]
//
// It builds an mvp.ExecuteRequest, posts it to the gateway's /execute
// endpoint, and pretty-prints the returned adapter JSON.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/TBD_PROJECT_NAME/core/protocol/mvp"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	switch os.Args[1] {
	case "get-pods":
		runGetPods(os.Args[2:])
	case "-h", "--help", "help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: client <subcommand> [flags]")
	fmt.Fprintln(os.Stderr, "subcommands:")
	fmt.Fprintln(os.Stderr, "  get-pods [-namespace NS] [-agent NAME] [-gateway URL]")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "MVP-only. No auth. No TLS. Localhost gateway.")
}

func runGetPods(args []string) {
	fs := flag.NewFlagSet("get-pods", flag.ExitOnError)
	namespace := fs.String("namespace", "", "kubernetes namespace (empty = all namespaces)")
	agent := fs.String("agent", "local-agent", "agent name to target")
	gateway := fs.String("gateway", "http://localhost:8080", "gateway base URL")
	if err := fs.Parse(args); err != nil {
		os.Exit(2)
	}

	req := mvp.ExecuteRequest{
		AgentName:   *agent,
		AdapterName: "k8s-get-pods",
		Params:      map[string]any{"namespace": *namespace},
	}
	body, err := json.Marshal(req)
	if err != nil {
		fatalf("marshal request: %v", err)
	}

	httpClient := &http.Client{Timeout: 90 * time.Second}
	resp, err := httpClient.Post(*gateway+"/execute", "application/json", bytes.NewReader(body))
	if err != nil {
		fatalf("POST /execute: %v", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		fatalf("read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		fatalf("gateway returned HTTP %d: %s", resp.StatusCode, string(raw))
	}

	var execResp mvp.ExecuteResponse
	if err := json.Unmarshal(raw, &execResp); err != nil {
		fatalf("decode response: %v\nraw body: %s", err, string(raw))
	}

	if !execResp.OK {
		fatalf("adapter failed: %s", execResp.Error)
	}

	var pretty bytes.Buffer
	if err := json.Indent(&pretty, execResp.ResultJSON, "", "  "); err != nil {
		// Not JSON, print raw
		fmt.Println(string(execResp.ResultJSON))
		return
	}
	fmt.Println(pretty.String())
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "client: "+format+"\n", args...)
	os.Exit(1)
}
