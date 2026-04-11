package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/TBD_PROJECT_NAME/core/gateway/internal/server"
)

func main() {
	addr := flag.String("addr", "localhost:8080", "listen address")
	flag.Parse()

	sigCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	srv := server.New()
	httpSrv := &http.Server{
		Addr:    *addr,
		Handler: srv.Handler(),
	}

	go func() {
		log.Printf("gateway listening on %s", *addr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen failed: %v", err)
		}
	}()

	<-sigCtx.Done()
	log.Printf("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
