# Plugin dev guide

## Rust
To enable targeting WASM, the `wasm32-unknown-unknown` target has to be installed.

> **NOTE:** This needs to be done *only once* for every environment.

```sh
rustup target add wasm32-unknown-unknown
```

Create a new library package using `cargo`:
```sh
cargo new --lib <your plugin name here>
```

Mark the package as a dynamic system library by adding the following lines to `Cargo.toml`:
```toml
[lib]
crate-type = ["cdylib"]
```

Build with the following command:
```sh
cargo build --target wasm32-unknown-unknown
```

### Example template
```rust
extern "C" {
    pub fn error(ptr: *const u8, len: usize);
    pub fn get_data(ptr: *mut u8);
    pub fn send(ptr: *const u8, len: usize) -> bool;
}

#[no_mangle]
pub extern fn receive(len: usize) {
    receive_from_host(&mut StaticHost{}, len)
}

// Host represents the host environment
trait Host {
    fn error(&mut self, ptr: *const u8, len: usize);
    fn get_data(&mut self, ptr: *mut u8);
    fn send(&mut self, ptr: *const u8, len: usize) -> bool;

    fn error_from_str(&mut self, msg: &str) {
        self.error(msg.as_ptr(), msg.len())
    }
}

// StaticHost implements a host environment using the imported (extern "C") functions
struct StaticHost {}

impl Host for StaticHost {
    fn error(&mut self, ptr: *const u8, len: usize) {
        unsafe { error(ptr, len) }
    }
    fn get_data(&mut self, ptr: *mut u8) {
        unsafe { get_data(ptr) }
    }
    fn send(&mut self, ptr: *const u8, len: usize) -> bool {
        unsafe { send(ptr, len) }
    }
}

fn receive_from_host<H: Host>(host: &mut H, len: usize) {
    let mut input = vec![0u8; len];

    host.get_data(input.as_mut_ptr());

    // TODO: process record
    //       - use `host.send` to send record to host
    //       - use `host.error` or `host.error_from_str` to signal an error to the host
}

#[cfg(test)]
mod tests {
    use std::slice;

    use super::*;

    struct TestHost {
        data: Option<Vec<u8>>,
        sent: Vec<Vec<u8>>,
    }

    impl Host for TestHost {
        fn error(&mut self, ptr: *const u8, len: usize) {
            let msg = std::str::from_utf8(unsafe { slice::from_raw_parts(ptr, len) }).unwrap();
            panic!("got error from plugin: {}", msg);
        }
        fn get_data(&mut self, ptr: *mut u8) {
            if let Some(data) = self.data.take() {
                let dst = unsafe { slice::from_raw_parts_mut(ptr, data.len()) };
                dst.copy_from_slice(data.as_slice());
            }
        }
        fn send(&mut self, ptr: *const u8, len: usize) -> bool {
            self.sent.push(Vec::from(unsafe { slice::from_raw_parts(ptr, len) }));
            true
        }
    }

    #[test]
    fn it_works() {
        receive_from_host(&mut TestHost{data: Default::default(), sent: Default::default()}, 0)
    }
}

```
