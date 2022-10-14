use chrono::DateTime;
use lazy_static::lazy_static;
use regex::Regex;

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
    fn error_from<E: ToString>(&mut self, err: &E) {
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

    let result = process_input(host, input.as_slice());

    host.send_slice(result.unwrap_or(input).as_slice());
}

fn process_input<H: Host>(host: &mut H, input: &[u8]) -> Option<Vec<u8>> {
    lazy_static! {
        static ref RE: Regex = Regex::new(r#"^(?P<remote>[^ ]*) (?P<host>[^ ]*) (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>[^"]*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>[^"]*)" "(?P<agent>[^"]*)"(?:\s+(?P<http_x_forwarded_for>[^ ]+))?)?$"#).unwrap();
    }
    
    match serde_json::from_slice::<serde_json::Value>(input) {
        Ok(mut value) => if let Some(obj) = value.as_object_mut() {
            let mut new_entries = Vec::new();

            if let Some(msg) = { obj.get("message").and_then(serde_json::Value::as_str) } {
                if let Some(captures) = RE.captures(msg) {
                    for name in RE.capture_names().flatten() {
                        if let Some(value) = captures.name(name).map(|m| m.as_str()) {
                            if name == "time" {
                                if let Ok(ts) = DateTime::parse_from_str(value, "%d/%b/%Y:%H:%M:%S %z") {
                                    new_entries.push((name.to_string(), ts.timestamp().to_string().into()));
                                    continue;
                                }
                            }
                            new_entries.push((name.to_string(), value.into()));
                        }
                    }
                }
            }

            if !new_entries.is_empty() {
                for entry in new_entries {
                    obj.insert(entry.0, entry.1);
                }
                return Some(serde_json::to_vec(obj).unwrap())
            }
        },
        Err(err) => host.error_from(&err)
    }
    None
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
