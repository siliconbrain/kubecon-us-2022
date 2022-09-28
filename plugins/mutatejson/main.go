package main

//go:wasm-module env
//export error
func error(ptr *byte, len uint)

//go:wasm-module env
//export get_data
func get_data(ptr *byte)

//go:wasm-module env
//export send
func send(ptr *byte, len uint) bool

//export receive
func receive(dataLen uint) {
	data := make([]byte, dataLen)
	get_data(&data[0])
	runes := []rune(string(data))
	for i := 0; i < len(runes)/2; i++ {
		j := len(runes) - 1 - i
		runes[i], runes[j] = runes[j], runes[i]
	}
	data = []byte(string(runes))
	send(&data[0], uint(len(data)))
}
