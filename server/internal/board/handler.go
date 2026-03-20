package board

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"antimax/internal/auth"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type createRequest struct {
	Title string `json:"title"`
}

type boardResponse struct {
	ID         string `json:"id"`
	OwnerID    string `json:"ownerId"`
	Title      string `json:"title"`
	InviteCode string `json:"inviteCode"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Title = "Untitled"
	}
	if strings.TrimSpace(req.Title) == "" {
		req.Title = "Untitled"
	}

	inviteCode := generateInviteCode()

	var resp boardResponse
	var createdAt, updatedAt time.Time
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO boards (owner_id, title, invite_code)
		 VALUES ($1, $2, $3)
		 RETURNING id, owner_id, title, invite_code, created_at, updated_at`,
		claims.UserID, req.Title, inviteCode,
	).Scan(&resp.ID, &resp.OwnerID, &resp.Title, &resp.InviteCode, &createdAt, &updatedAt)
	if err != nil {
		log.Printf("[BOARD] Create error: %v", err)
		http.Error(w, `{"error":"failed to create board"}`, http.StatusInternalServerError)
		return
	}
	resp.CreatedAt = createdAt.Format(time.RFC3339)
	resp.UpdatedAt = updatedAt.Format(time.RFC3339)

	_, err = h.db.Exec(r.Context(),
		"INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')",
		resp.ID, claims.UserID,
	)
	if err != nil {
		log.Printf("[BOARD] Add member error: %v", err)
		http.Error(w, `{"error":"failed to add member"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("[BOARD] Created id=%s title=%q owner=%s", resp.ID, resp.Title, claims.UserID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT b.id, b.owner_id, b.title, b.invite_code, b.created_at, b.updated_at
		 FROM boards b
		 JOIN board_members bm ON b.id = bm.board_id
		 WHERE bm.user_id = $1
		 ORDER BY b.updated_at DESC`,
		claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to list boards"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var boards []boardResponse
	for rows.Next() {
		var b boardResponse
		var ca, ua time.Time
		if err := rows.Scan(&b.ID, &b.OwnerID, &b.Title, &b.InviteCode, &ca, &ua); err != nil {
			continue
		}
		b.CreatedAt = ca.Format(time.RFC3339)
		b.UpdatedAt = ua.Format(time.RFC3339)
		boards = append(boards, b)
	}

	if boards == nil {
		boards = []boardResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(boards)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	boardID := chi.URLParam(r, "id")

	var isMember bool
	h.db.QueryRow(r.Context(),
		"SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id=$1 AND user_id=$2)",
		boardID, claims.UserID,
	).Scan(&isMember)

	if !isMember {
		http.Error(w, `{"error":"not a member of this board"}`, http.StatusForbidden)
		return
	}

	var resp boardResponse
	var ca, ua time.Time
	err := h.db.QueryRow(r.Context(),
		"SELECT id, owner_id, title, invite_code, created_at, updated_at FROM boards WHERE id=$1",
		boardID,
	).Scan(&resp.ID, &resp.OwnerID, &resp.Title, &resp.InviteCode, &ca, &ua)
	if err != nil {
		http.Error(w, `{"error":"board not found"}`, http.StatusNotFound)
		return
	}
	resp.CreatedAt = ca.Format(time.RFC3339)
	resp.UpdatedAt = ua.Format(time.RFC3339)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	boardID := chi.URLParam(r, "id")

	result, err := h.db.Exec(r.Context(),
		"DELETE FROM boards WHERE id=$1 AND owner_id=$2",
		boardID, claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to delete"}`, http.StatusInternalServerError)
		return
	}
	if result.RowsAffected() == 0 {
		http.Error(w, `{"error":"board not found or not owner"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) JoinByCode(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	code := chi.URLParam(r, "code")

	var boardID string
	err := h.db.QueryRow(r.Context(),
		"SELECT id FROM boards WHERE invite_code=$1",
		code,
	).Scan(&boardID)
	if err != nil {
		http.Error(w, `{"error":"invalid invite code"}`, http.StatusNotFound)
		return
	}

	_, err = h.db.Exec(r.Context(),
		`INSERT INTO board_members (board_id, user_id, role)
		 VALUES ($1, $2, 'editor')
		 ON CONFLICT (board_id, user_id) DO NOTHING`,
		boardID, claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to join"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"boardId": boardID})
}
