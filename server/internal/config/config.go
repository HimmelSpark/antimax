package config

import "os"

type Config struct {
	ServerPort   string
	JWTSecret    string
	DatabaseURL  string
	RedisURL     string
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket    string
	MinioUseSSL    bool
	LivekitHost      string
	LivekitPublicURL string
	LivekitAPIKey    string
	LivekitAPISecret string
	GotenbergURL string
	CORSOrigin   string
}

func Load() *Config {
	return &Config{
		ServerPort:       getEnv("SERVER_PORT", "8080"),
		JWTSecret:        getEnv("JWT_SECRET", "change-me"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://antimax:antimax@localhost:5433/antimax?sslmode=disable"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379"),
		MinioEndpoint:    getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey:   getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey:   getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucket:      getEnv("MINIO_BUCKET", "antimax"),
		MinioUseSSL:      getEnv("MINIO_USE_SSL", "false") == "true",
		LivekitHost:      getEnv("LIVEKIT_HOST", "http://localhost:7880"),
		LivekitPublicURL: getEnv("LIVEKIT_PUBLIC_URL", "ws://localhost:7880"),
		LivekitAPIKey:    getEnv("LIVEKIT_API_KEY", "devkey"),
		LivekitAPISecret: getEnv("LIVEKIT_API_SECRET", "secret1234567890secret1234567890"),
		GotenbergURL:     getEnv("GOTENBERG_URL", "http://localhost:3001"),
		CORSOrigin:       getEnv("CORS_ORIGIN", "http://localhost:3000"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
