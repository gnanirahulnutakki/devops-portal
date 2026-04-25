FROM golang:1.23-alpine AS builder
WORKDIR /workspace
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/agent ./agent/cmd/agent

FROM alpine:3.20
RUN apk add --no-cache curl ca-certificates && \
    addgroup -g 1000 agent && \
    adduser -D -u 1000 -G agent agent
USER 1000:1000
COPY --from=builder /out/agent /agent
ENTRYPOINT ["/agent"]
