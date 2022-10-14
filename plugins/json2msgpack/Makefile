.PHONY: build
build:
	cargo build --target wasm32-unknown-unknown ${BUILD_FLAGS}

.PHONY: build-release
build-release: BUILD_FLAGS := -r
build-release: build
