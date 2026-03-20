package models

import "time"

type ChatMessage struct {
	ID          string    `json:"id"`
	BoardID     string    `json:"boardId"`
	UserID      string    `json:"userId"`
	DisplayName string    `json:"displayName"`
	Content     string    `json:"content"`
	CreatedAt   time.Time `json:"createdAt"`
}
