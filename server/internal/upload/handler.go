package upload

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"antimax/internal/auth"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
)

type Handler struct {
	db     *pgxpool.Pool
	minio  *minio.Client
	bucket string
}

func NewHandler(db *pgxpool.Pool, minioClient *minio.Client, bucket string) *Handler {
	return &Handler{db: db, minio: minioClient, bucket: bucket}
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 50<<20) // 50MB limit

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, `{"error":"file too large (max 50MB)"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	boardID := r.FormValue("boardId")
	if boardID == "" {
		http.Error(w, `{"error":"boardId is required"}`, http.StatusBadRequest)
		return
	}

	ext := filepath.Ext(header.Filename)
	storageKey := fmt.Sprintf("%s/%s%s", boardID, uuid.New().String(), ext)

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	_, err = h.minio.PutObject(ctx, h.bucket, storageKey, file, header.Size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		log.Printf("[UPLOAD] MinIO put error: %v", err)
		http.Error(w, `{"error":"failed to upload file"}`, http.StatusInternalServerError)
		return
	}

	var fileID string
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO uploaded_files (board_id, user_id, filename, mime_type, storage_key, size_bytes)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		boardID, claims.UserID, header.Filename, contentType, storageKey, header.Size,
	).Scan(&fileID)
	if err != nil {
		log.Printf("[UPLOAD] DB insert error: %v", err)
		http.Error(w, `{"error":"failed to save file record"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("[UPLOAD] file=%s size=%d board=%s user=%s", header.Filename, header.Size, boardID, claims.UserID)

	fileURL := fmt.Sprintf("/api/files/%s", storageKey)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":       fileID,
		"url":      fileURL,
		"filename": header.Filename,
		"mimeType": contentType,
	})
}

func (h *Handler) ServeFile(w http.ResponseWriter, r *http.Request) {
	storageKey := strings.TrimPrefix(r.URL.Path, "/api/files/")
	if storageKey == "" {
		http.Error(w, `{"error":"invalid path"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	obj, err := h.minio.GetObject(ctx, h.bucket, storageKey, minio.GetObjectOptions{})
	if err != nil {
		http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
		return
	}
	defer obj.Close()

	info, err := obj.Stat()
	if err != nil {
		http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size, 10))
	w.Header().Set("Cache-Control", "public, max-age=31536000")
	io.Copy(w, obj)
}
