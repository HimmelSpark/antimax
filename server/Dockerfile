FROM golang:latest AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev || true

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /server /server
COPY --from=builder /app/internal/db/migrations /app/internal/db/migrations

EXPOSE 8080

CMD ["/server"]
