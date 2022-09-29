package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
)

func main() {
	addr := flag.String("addr", ":20080", "listen address")
	if err := http.ListenAndServe(*addr, http.FileServer(http.Dir("."))); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
