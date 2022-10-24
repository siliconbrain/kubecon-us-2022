#!/bin/sh
echo "ws://localhost:10001/flow/default/nullout?token="$(kubectl create token alice --duration=6h)