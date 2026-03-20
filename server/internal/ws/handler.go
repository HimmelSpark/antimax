package ws

import (
	"log"
	"net/http"

	"antimax/internal/auth"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSHandler struct {
	hub    *Hub
	secret string
}

func NewWSHandler(hub *Hub, secret string) *WSHandler {
	return &WSHandler{hub: hub, secret: secret}
}

func (h *WSHandler) HandleConnect(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "id")
	if boardID == "" {
		http.Error(w, "missing board id", http.StatusBadRequest)
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(h.secret, token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := NewClient(h.hub, conn, boardID, claims.UserID, claims.DisplayName)
	h.hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}
