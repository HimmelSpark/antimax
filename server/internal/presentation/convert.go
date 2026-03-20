package presentation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"antimax/internal/auth"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

type Handler struct {
	gotenbergURL string
	minioClient  *minio.Client
	bucket       string
}

func NewHandler(gotenbergURL string, minioClient *minio.Client, bucket string) *Handler {
	return &Handler{
		gotenbergURL: gotenbergURL,
		minioClient:  minioClient,
		bucket:       bucket,
	}
}

func (h *Handler) Convert(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 100<<20) // 100MB limit

	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, `{"error":"file too large"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	boardID := r.FormValue("boardId")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("files", header.Filename)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	io.Copy(part, file)
	writer.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	gotenbergURL := fmt.Sprintf("%s/forms/libreoffice/convert", h.gotenbergURL)
	req, err := http.NewRequestWithContext(ctx, "POST", gotenbergURL, &body)
	if err != nil {
		http.Error(w, `{"error":"conversion request failed"}`, http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, `{"error":"conversion service unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, `{"error":"conversion failed"}`, http.StatusInternalServerError)
		return
	}

	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read converted file"}`, http.StatusInternalServerError)
		return
	}

	storageKey := fmt.Sprintf("%s/presentations/%s.pdf", boardID, uuid.New().String())
	_, err = h.minioClient.PutObject(ctx, h.bucket, storageKey, bytes.NewReader(pdfData), int64(len(pdfData)), minio.PutObjectOptions{
		ContentType: "application/pdf",
	})
	if err != nil {
		http.Error(w, `{"error":"failed to store PDF"}`, http.StatusInternalServerError)
		return
	}

	fileURL := fmt.Sprintf("/api/files/%s", storageKey)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": fileURL,
	})
}
