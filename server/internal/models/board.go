package models

import "time"

type Board struct {
	ID           string    `json:"id"`
	OwnerID      string    `json:"ownerId"`
	Title        string    `json:"title"`
	InviteCode   string    `json:"inviteCode"`
	ThumbnailURL *string   `json:"thumbnailUrl"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type BoardMember struct {
	BoardID  string    `json:"boardId"`
	UserID   string    `json:"userId"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joinedAt"`
}
