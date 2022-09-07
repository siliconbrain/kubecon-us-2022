package main

import (
	"golang.org/x/exp/slices"
)

//go:wasm-module env
//export error
func error(ptr *byte, len uint)

//go:wasm-module env
//export get_data
func get_data(ptr *byte)

//go:wasm-module env
//export send
func send(ptr *byte, len uint)

//export receive
func receive(len uint) {
	data := make([]byte, len)
	get_data(&data[0])
	slices.Sort(data)
	send(&data[0], len)
}
