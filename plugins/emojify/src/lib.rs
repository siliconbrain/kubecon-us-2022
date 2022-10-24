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
    fn error_from<E: ToString + ?Sized>(&mut self, err: &E) {
        self.error_from_str(err.to_string().as_str())
    }

    fn send_slice(&mut self, v: &[u8]) {
        self.send(v.as_ptr(), v.len());
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

    let output = process_input(&input);

    host.send_slice(output.as_slice());
}

fn process_input(input: &[u8]) -> Vec<u8> {
    let table = [
        ("agent".as_bytes(), "🕵️".as_bytes()),
        ("allow".as_bytes(), "👍".as_bytes()),
        ("cloud".as_bytes(), "☁️".as_bytes()),
        ("container".as_bytes(), "📦".as_bytes()),
        ("docker".as_bytes(), "🐳".as_bytes()),
        ("eye".as_bytes(), "👁".as_bytes()),
        ("hash".as_bytes(), "#️⃣".as_bytes()),
        ("host".as_bytes(), "💻".as_bytes()),
        ("id".as_bytes(), "🪪".as_bytes()),
        ("image".as_bytes(), "🖼".as_bytes()),
        ("kubernetes".as_bytes(), "🧑‍✈️".as_bytes()),
        ("label".as_bytes(), "🏷".as_bytes()),
        ("log".as_bytes(), "🪵".as_bytes()),
        ("message".as_bytes(), "✉️".as_bytes()),
        ("path".as_bytes(), "🛣".as_bytes()),
        ("pod".as_bytes(), "🛰".as_bytes()),
        ("space".as_bytes(), "🚀".as_bytes()),
        ("stream".as_bytes(), "🚿".as_bytes()),
        ("time".as_bytes(), "⏰".as_bytes()),
        ("user".as_bytes(), "🧑".as_bytes()),
    ];

    let mut output = Vec::new();
    let mut from = 0;
    while from < input.len() {
        let input = &input[from..];
        let mut swapped = false;
        for (pattern, replacement) in table {
            if input.starts_with(pattern) {
                output.extend_from_slice(replacement);
                from += pattern.len();
                swapped = true;
                break;
            }
        }
        if !swapped {
            output.push(input[0]);
            from += 1;
        }
    }

    output
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
        assert_eq!(process_input(b"xagent"), Vec::from("x🕵️"));
    }
}
