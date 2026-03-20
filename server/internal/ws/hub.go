package ws

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Room struct {
	clients map[*Client]bool
	updates [][]byte // individual Yjs updates
	mu      sync.RWMutex
}

type BroadcastMessage struct {
	roomID  string
	sender  *Client
	payload []byte
}

type Hub struct {
	rooms      map[string]*Room
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
	mu         sync.RWMutex
	db         *pgxpool.Pool
	rdb        *redis.Client
}

func NewHub(db *pgxpool.Pool, rdb *redis.Client) *Hub {
	return &Hub{
		rooms:      make(map[string]*Room),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
		broadcast:  make(chan *BroadcastMessage, 1024),
		db:         db,
		rdb:        rdb,
	}
}

func (h *Hub) Run() {
	go h.snapshotLoop()

	for {
		select {
		case client := <-h.register:
			h.addClient(client)
		case client := <-h.unregister:
			h.removeClient(client)
		case msg := <-h.broadcast:
			h.handleBroadcast(msg)
		}
	}
}

func (h *Hub) addClient(client *Client) {
	h.mu.Lock()
	room, exists := h.rooms[client.roomID]
	if !exists {
		room = &Room{
			clients: make(map[*Client]bool),
		}
		h.rooms[client.roomID] = room

		updates := h.loadYjsUpdates(client.roomID)
		if len(updates) > 0 {
			room.updates = updates
		}
	}
	h.mu.Unlock()

	room.mu.Lock()
	room.clients[client] = true

	// Send each stored update individually so client can apply them one by one
	for _, update := range room.updates {
		msg := make([]byte, len(update)+1)
		msg[0] = MsgTypeYjsSync
		copy(msg[1:], update)
		client.send <- msg
	}
	room.mu.Unlock()

	log.Printf("Client %s joined room %s (%d clients)", client.userID, client.roomID, len(room.clients))

	if h.rdb != nil {
		h.rdb.Publish(context.Background(),
			fmt.Sprintf("room:%s:join", client.roomID),
			client.userID,
		)
	}
}

func (h *Hub) removeClient(client *Client) {
	h.mu.RLock()
	room, exists := h.rooms[client.roomID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.mu.Lock()
	if _, ok := room.clients[client]; ok {
		delete(room.clients, client)
		close(client.send)
	}
	isEmpty := len(room.clients) == 0
	room.mu.Unlock()

	if isEmpty {
		room.mu.RLock()
		updates := make([][]byte, len(room.updates))
		copy(updates, room.updates)
		room.mu.RUnlock()
		h.saveYjsUpdates(client.roomID, updates)
		h.mu.Lock()
		delete(h.rooms, client.roomID)
		h.mu.Unlock()
	}

	log.Printf("Client %s left room %s", client.userID, client.roomID)
}

func (h *Hub) handleBroadcast(msg *BroadcastMessage) {
	h.mu.RLock()
	room, exists := h.rooms[msg.roomID]
	h.mu.RUnlock()

	if !exists || len(msg.payload) == 0 {
		return
	}

	msgType := msg.payload[0]

	switch msgType {
	case MsgTypeYjsUpdate:
		update := make([]byte, len(msg.payload)-1)
		copy(update, msg.payload[1:])
		room.mu.Lock()
		room.updates = append(room.updates, update)
		room.mu.Unlock()
	case MsgTypeYjsSync:
		// Treat client sync as a regular update — append it
		update := make([]byte, len(msg.payload)-1)
		copy(update, msg.payload[1:])
		room.mu.Lock()
		room.updates = append(room.updates, update)
		room.mu.Unlock()
	case MsgTypeChat:
		h.persistChat(msg)
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	for client := range room.clients {
		if client == msg.sender {
			continue
		}
		select {
		case client.send <- msg.payload:
		default:
			go func(c *Client) {
				h.unregister <- c
			}(client)
		}
	}

	if h.rdb != nil {
		h.rdb.Publish(context.Background(),
			fmt.Sprintf("room:%s:msg", msg.roomID),
			msg.payload,
		)
	}
}

func (h *Hub) persistChat(msg *BroadcastMessage) {
	if len(msg.payload) < 2 {
		return
	}

	var chat ChatPayload
	if err := json.Unmarshal(msg.payload[1:], &chat); err != nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	h.db.Exec(ctx,
		"INSERT INTO chat_messages (board_id, user_id, content) VALUES ($1, $2, $3)",
		msg.roomID, chat.UserID, chat.Content,
	)
}

func (h *Hub) loadYjsUpdates(roomID string) [][]byte {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var data []byte
	err := h.db.QueryRow(ctx, "SELECT yjs_state FROM boards WHERE id=$1", roomID).Scan(&data)
	if err != nil || len(data) == 0 {
		return nil
	}

	return decodeUpdates(data)
}

func (h *Hub) saveYjsUpdates(roomID string, updates [][]byte) {
	if len(updates) == 0 {
		return
	}

	data := encodeUpdates(updates)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := h.db.Exec(ctx, "UPDATE boards SET yjs_state=$1, updated_at=now() WHERE id=$2", data, roomID)
	if err != nil {
		log.Printf("Failed to save yjs state for room %s: %v", roomID, err)
	}
}

// encodeUpdates serializes updates with 4-byte length prefix framing
func encodeUpdates(updates [][]byte) []byte {
	totalLen := 0
	for _, u := range updates {
		totalLen += 4 + len(u)
	}
	buf := make([]byte, 0, totalLen)
	for _, u := range updates {
		lenBytes := make([]byte, 4)
		binary.BigEndian.PutUint32(lenBytes, uint32(len(u)))
		buf = append(buf, lenBytes...)
		buf = append(buf, u...)
	}
	return buf
}

// decodeUpdates parses length-prefixed updates; falls back to single-update for legacy data
func decodeUpdates(data []byte) [][]byte {
	var updates [][]byte
	offset := 0
	for offset+4 <= len(data) {
		uLen := int(binary.BigEndian.Uint32(data[offset : offset+4]))
		offset += 4
		if offset+uLen > len(data) {
			// Corrupted framing — treat entire blob as single legacy update
			return [][]byte{data}
		}
		updates = append(updates, data[offset:offset+uLen])
		offset += uLen
	}
	if len(updates) == 0 && len(data) > 0 {
		// No valid framing — legacy raw blob, treat as single update
		return [][]byte{data}
	}
	return updates
}

func (h *Hub) snapshotLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		h.mu.RLock()
		roomUpdates := make(map[string][][]byte)
		for id, room := range h.rooms {
			room.mu.RLock()
			if len(room.updates) > 0 {
				updates := make([][]byte, len(room.updates))
				copy(updates, room.updates)
				roomUpdates[id] = updates
			}
			room.mu.RUnlock()
		}
		h.mu.RUnlock()

		for id, updates := range roomUpdates {
			h.saveYjsUpdates(id, updates)
		}
	}
}
