package main

import (
	"fmt"
	"strings"

	"github.com/buger/jsonparser"
)

//go:wasm-module env
//export error
func Error(ptr *byte, len uint)

//go:wasm-module env
//export get_data
func GetData(ptr *byte)

//go:wasm-module env
//export send
func Send(ptr *byte, len uint) bool

//export receive
func Receive(dataLen uint) {
	if dataLen == 0 {
		return
	}
	data := make([]byte, dataLen)
	GetData(&data[0])
	agent, err := jsonparser.GetString(data, "agent")
	if err != nil {
		signalError(err)
		sendBytes(data)
		return
	}
	agent = fmt.Sprintf("%q", agent)
	newAgent := agent
	for pattern, value := range map[string]string{
		"Android":   "🤖",
		"Apple":     "🍏",
		"ARM":       "🦾",
		"Build":     "🏗",
		"Chrome":    "🛞",
		"Chromium":  "⚙️",
		"Edge":      "🌊",
		"Fedora":    "🎩",
		"Firefox":   "🦊",
		"Gecko":     "🦎",
		"Iceweasel": "❄️",
		"IE":        "🪐",
		"J2ME":      "☕️",
		"Linux":     "🐧",
		"Macintosh": "🍎",
		"Mobile":    "📱",
		"Mozilla":   "🦖",
		"Opera":     "🍩",
		"Phone":     "☎️",
		"Presto":    "🪄",
		"Safari":    "🧭",
		"Touch":     "🖐",
		"Trident":   "🔱",
		"Vivaldi":   "🎻",
		"Web":       "🕸",
		"Windows":   "🪟",
	} {
		newAgent = strings.ReplaceAll(newAgent, pattern, value)
	}
	if agent == newAgent {
		sendBytes(data)
		return
	}
	newData, err := jsonparser.Set(data, []byte(newAgent), "agent")
	if err != nil {
		signalError(err)
		sendBytes(data)
		return
	}
	sendBytes(newData)
}

func sendBytes(bs []byte) bool {
	if l := len(bs); l > 0 {
		return Send(&bs[0], uint(l))
	}
	return true
}

func signalError(err error) {
	msg := []byte(err.Error())
	Error(&msg[0], uint(len(msg)))
}

func main() {}
