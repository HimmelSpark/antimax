package auth

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db     *pgxpool.Pool
	secret string
}

func NewHandler(db *pgxpool.Pool, secret string) *Handler {
	return &Handler{db: db, secret: secret}
}

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
	User  struct {
		ID          string `json:"id"`
		Email       string `json:"email"`
		DisplayName string `json:"displayName"`
	} `json:"user"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if req.Email == "" || req.Password == "" || req.DisplayName == "" {
		http.Error(w, `{"error":"email, password and displayName are required"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 6 {
		http.Error(w, `{"error":"password must be at least 6 characters"}`, http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[AUTH] Register: bcrypt error: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	var userID string
	err = h.db.QueryRow(r.Context(),
		"INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
		req.Email, string(hash), req.DisplayName,
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			log.Printf("[AUTH] Register: duplicate email %s", req.Email)
			http.Error(w, `{"error":"email already registered"}`, http.StatusConflict)
			return
		}
		log.Printf("[AUTH] Register: DB insert error: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	token, err := GenerateToken(h.secret, userID, req.Email, req.DisplayName)
	if err != nil {
		log.Printf("[AUTH] Register: token generation error: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("[AUTH] Register: user created id=%s email=%s", userID, req.Email)

	resp := authResponse{}
	resp.Token = token
	resp.User.ID = userID
	resp.User.Email = req.Email
	resp.User.DisplayName = req.DisplayName

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var userID, passwordHash, displayName string
	err := h.db.QueryRow(r.Context(),
		"SELECT id, password_hash, display_name FROM users WHERE email=$1",
		req.Email,
	).Scan(&userID, &passwordHash, &displayName)
	if err != nil {
		log.Printf("[AUTH] Login: user not found email=%s err=%v", req.Email, err)
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		log.Printf("[AUTH] Login: wrong password email=%s", req.Email)
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	token, err := GenerateToken(h.secret, userID, req.Email, displayName)
	if err != nil {
		log.Printf("[AUTH] Login: token generation error: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("[AUTH] Login: success id=%s email=%s", userID, req.Email)

	resp := authResponse{}
	resp.Token = token
	resp.User.ID = userID
	resp.User.Email = req.Email
	resp.User.DisplayName = displayName

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims := GetUser(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"id":          claims.UserID,
		"email":       claims.Email,
		"displayName": claims.DisplayName,
	})
}
