package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"displayName"`
	AvatarURL    *string   `json:"avatarUrl"`
	CreatedAt    time.Time `json:"createdAt"`
}
