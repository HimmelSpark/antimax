package qr

import (
	"encoding/base64"

	qrcode "github.com/skip2/go-qrcode"
)

func GenerateBase64(content string) (string, error) {
	png, err := qrcode.Encode(content, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}
