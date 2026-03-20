package board

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"antimax/internal/auth"
	"antimax/pkg/qr"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InviteHandler struct {
	db         *pgxpool.Pool
	corsOrigin string
}

func NewInviteHandler(db *pgxpool.Pool, corsOrigin string) *InviteHandler {
	return &InviteHandler{db: db, corsOrigin: corsOrigin}
}

func (h *InviteHandler) GetInvite(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	boardID := chi.URLParam(r, "id")

	var inviteCode string
	err := h.db.QueryRow(r.Context(),
		"SELECT invite_code FROM boards WHERE id=$1", boardID,
	).Scan(&inviteCode)
	if err != nil {
		http.Error(w, `{"error":"board not found"}`, http.StatusNotFound)
		return
	}

	inviteURL := fmt.Sprintf("%s/join/%s", h.corsOrigin, inviteCode)

	qrBase64, err := qr.GenerateBase64(inviteURL)
	if err != nil {
		http.Error(w, `{"error":"failed to generate QR"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"inviteCode": inviteCode,
		"inviteUrl":  inviteURL,
		"qrCode":     qrBase64,
	})
}

func generateInviteCode() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}
