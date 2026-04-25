FROM golang:1.23-alpine AS builder
WORKDIR /workspace
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/gateway ./gateway/cmd/gateway

FROM gcr.io/distroless/static:nonroot
USER 65532:65532
COPY --from=builder /out/gateway /gateway
EXPOSE 8080
ENTRYPOINT ["/gateway"]
