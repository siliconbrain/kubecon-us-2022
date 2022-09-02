use std::{io::Cursor, iter::Iterator};

extern "C" {
    pub fn error(ptr: *const u8, len: usize);
    pub fn get_data(ptr: *mut u8);
    pub fn send(ptr: *mut u8, len: usize) -> bool;
}

#[no_mangle]
pub extern fn configure(_ptr: *const u8, _len: usize) {
    // TODO
}

#[no_mangle]
pub extern fn receive(len: usize) {
    receive_from_host(&mut StaticHost{}, len)
}

// Host represents the host environment
trait Host {
    fn error(&mut self, ptr: *const u8, len: usize);
    fn get_data(&mut self, ptr: *mut u8);
    fn send(&mut self, ptr: *mut u8, len: usize) -> bool;

    fn signal_error(&mut self, msg: &str) {
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
    fn send(&mut self, ptr: *mut u8, len: usize) -> bool {
        unsafe { send(ptr, len) }
    }
}

fn receive_from_host<H: Host>(host: &mut H, len: usize) {
    let mut input = Vec::with_capacity(len);
    input.resize(len, 0u8);

    host.get_data(input.as_mut_ptr());

    let mut res = Cursor::new(Vec::new());

    // json -> msgpack
    match serde_json::from_slice::<serde_json::Value>(input.as_slice()).as_ref().map(convert_value) {
        Ok(msgpack_val) => if let Some(err) = rmpv::encode::write_value(&mut res, &msgpack_val).err() {
            host.signal_error(err.to_string().as_str());
            return
        },
        Err(err) => {
            host.signal_error(err.to_string().as_str());
            return
        },
    }

    let output = res.get_mut();
    host.send(output.as_mut_ptr(), output.len());
}

fn convert_value(val: &serde_json::Value) -> rmpv::Value {
    match val {
        serde_json::Value::Array(a) => rmpv::Value::Array(a.iter().map(convert_value).collect()),
        serde_json::Value::Bool(b) => rmpv::Value::Boolean(*b),
        serde_json::Value::Null => rmpv::Value::Nil,
        serde_json::Value::Number(n) => rmpv::Value::F64(n.as_f64().expect("number not representable as f64")),
        serde_json::Value::Object(o) => rmpv::Value::Map(o.iter().map(|(k, v)| (rmpv::Value::from(k.as_str()), convert_value(v))).collect()),
        serde_json::Value::String(s) => rmpv::Value::from(s.as_str()),
    }
}

#[cfg(test)]
mod tests {
    use std::slice;

    use super::*;

    struct TestHost {
        data: Option<Vec<u8>>,
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
        fn send(&mut self, ptr: *mut u8, len: usize) -> bool {
            self.data = Some(Vec::from(unsafe { slice::from_raw_parts(ptr, len) }));
            true
        }
    }

    fn check_conversion(input: &[u8], expected: &rmpv::Value) {
        let mut host = TestHost { data: Some(Vec::from(input)) };
        receive_from_host(&mut host, input.len());
        if let Some(output) = host.data.take() {
            let expected = {
                let mut v = Vec::new();
                rmpv::encode::write_value(&mut v, expected).unwrap();
                v
            };
            assert_eq!(expected.as_slice(), output.as_slice());
        }
    }

    #[test]
    fn null_becomes_nil() {
        check_conversion(b"null", &rmpv::Value::Nil);
    }

    #[test]
    fn false_becomes_false() {
        check_conversion(b"false", &rmpv::Value::Boolean(false));
    }

    #[test]
    fn true_becomes_true() {
        check_conversion(b"true", &rmpv::Value::Boolean(true));
    }

    #[test]
    fn empty_object_becomes_empty_map() {
        check_conversion(b"{}", &rmpv::Value::Map(Vec::new()));
    }

    #[test]
    fn object_becomes_map() {
        check_conversion(
            b"{\"null\": null, \"false\": false, \"true\": true, \"number\": 42, \"string\": \"asdf\", \"array\": [], \"object\": {}}",
            &rmpv::Value::Map(vec![
                (rmpv::Value::from("array"), rmpv::Value::Array(Vec::new())),
                (rmpv::Value::from("false"), rmpv::Value::Boolean(false)),
                (rmpv::Value::from("null"), rmpv::Value::Nil),
                (rmpv::Value::from("number"), rmpv::Value::F64(42_f64)),
                (rmpv::Value::from("object"), rmpv::Value::Map(Vec::new())),
                (rmpv::Value::from("string"), rmpv::Value::from("asdf")),
                (rmpv::Value::from("true"), rmpv::Value::Boolean(true)),
            ]));
    }
}
