package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"antimax/internal/auth"
	"antimax/internal/board"
	"antimax/internal/config"
	"antimax/internal/db"
	"antimax/internal/livekit"
	"antimax/internal/presentation"
	"antimax/internal/upload"
	"antimax/internal/ws"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	migrationsDir := "/app/internal/db/migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		// Local development: relative to working directory
		migrationsDir = "internal/db/migrations"
	}
	if err := db.RunMigrations(pool, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Migrations applied successfully")

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis")

	minioClient, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		log.Fatalf("Failed to connect to MinIO: %v", err)
	}
	log.Println("Connected to MinIO")

	hub := ws.NewHub(pool, rdb)
	go hub.Run()

	authHandler := auth.NewHandler(pool, cfg.JWTSecret)
	boardHandler := board.NewHandler(pool)
	inviteHandler := board.NewInviteHandler(pool, cfg.CORSOrigin)
	uploadHandler := upload.NewHandler(pool, minioClient, cfg.MinioBucket)
	livekitHandler := livekit.NewHandler(cfg.LivekitAPIKey, cfg.LivekitAPISecret, cfg.LivekitPublicURL)
	wsHandler := ws.NewWSHandler(hub, cfg.JWTSecret)
	presentationHandler := presentation.NewHandler(cfg.GotenbergURL, minioClient, cfg.MinioBucket)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.CORSOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)

	r.Group(func(r chi.Router) {
		r.Use(auth.Middleware(cfg.JWTSecret))

		r.Get("/api/auth/me", authHandler.Me)

		r.Get("/api/boards", boardHandler.List)
		r.Post("/api/boards", boardHandler.Create)
		r.Get("/api/boards/{id}", boardHandler.Get)
		r.Delete("/api/boards/{id}", boardHandler.Delete)
		r.Get("/api/boards/{id}/invite", inviteHandler.GetInvite)
		r.Post("/api/boards/join/{code}", boardHandler.JoinByCode)

		r.Post("/api/upload", uploadHandler.Upload)
		r.Post("/api/convert", presentationHandler.Convert)

		r.Get("/api/livekit/token", livekitHandler.GetToken)
	})

	r.Get("/api/files/*", uploadHandler.ServeFile)

	r.Get("/ws/board/{id}", wsHandler.HandleConnect)

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
