package main

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
	runes := []rune(string(data))
	for i := 0; i < len(runes)/2; i++ {
		j := len(runes) - 1 - i
		runes[i], runes[j] = runes[j], runes[i]
	}
	data = []byte(string(runes))
	Send(&data[0], uint(len(data)))
	Send(&data[0], uint(len(data)))
}

func main() {}
