package livekit

import (
	"encoding/json"
	"net/http"
	"time"

	"antimax/internal/auth"

	lksdk "github.com/livekit/server-sdk-go/v2"
	lkauth "github.com/livekit/protocol/auth"
)

type Handler struct {
	apiKey    string
	apiSecret string
	publicURL string
}

func NewHandler(apiKey, apiSecret, publicURL string) *Handler {
	return &Handler{apiKey: apiKey, apiSecret: apiSecret, publicURL: publicURL}
}

// Ensure lksdk is used (needed for dependency)
var _ = lksdk.ConnectToRoom

func (h *Handler) GetToken(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	roomID := r.URL.Query().Get("boardId")
	if roomID == "" {
		http.Error(w, `{"error":"boardId is required"}`, http.StatusBadRequest)
		return
	}

	at := lkauth.NewAccessToken(h.apiKey, h.apiSecret)
	grant := &lkauth.VideoGrant{
		RoomJoin: true,
		Room:     roomID,
	}
	at.AddGrant(grant).
		SetIdentity(claims.UserID).
		SetName(claims.DisplayName).
		SetValidFor(24 * time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token, "url": h.publicURL})
}
