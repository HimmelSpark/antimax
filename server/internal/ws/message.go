package ws

const (
	MsgTypeYjsSync      byte = 0x00
	MsgTypeYjsUpdate    byte = 0x01
	MsgTypeYjsAwareness byte = 0x02
	MsgTypeChat         byte = 0x10
	MsgTypeReaction      byte = 0x11
	MsgTypePresentation  byte = 0x12
)

type ChatPayload struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	Content     string `json:"content"`
	Timestamp   string `json:"timestamp"`
}

type ReactionPayload struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	Emoji       string `json:"emoji"`
}

type PresentationPayload struct {
	Action string `json:"action"` // start, stop, page_change, cursor
	DocURL string `json:"docUrl,omitempty"`
	Total  int    `json:"total,omitempty"`
	Page   int    `json:"page,omitempty"`
	X      float64 `json:"x,omitempty"`
	Y      float64 `json:"y,omitempty"`
	UserID string `json:"userId"`
	DisplayName string `json:"displayName"`
}
