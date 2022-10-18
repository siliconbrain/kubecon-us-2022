// The entry file of your WebAssembly module.

import { JSON } from 'assemblyscript-json/assembly'

// @ts-ignore: decorator
@external("env", "error")
export declare function error(src: ArrayBuffer, len: usize): void
// @ts-ignore: decorator
@external("env", "get_data")
export declare function get_data(dst: ArrayBuffer): void
// @ts-ignore: decorator
@external("env", "send")
export declare function send(src: ArrayBuffer, len: usize): bool

export function receive(len: usize): void {
  let data = new ArrayBuffer(len as i32);
  get_data(data);
  let record = JSON.parse(Uint8Array.wrap(data));
  if (record.isObj) {
    let rootObj = <JSON.Obj>(record);
    let statusCode = rootObj.getString("code");
    if (statusCode) {
      let code = parseInt(statusCode.valueOf());
      let emoji = "";
      if (100 <= code && code <= 199) {
        emoji = "💬️";
      } else if (200 <= code && code <= 299) {
        emoji = "🙂";
      } else if (300 <= code && code <= 399) {
        emoji = "👉"
      } else if (400 <= code && code <= 499) {
        emoji = "🙁"
      } else if (500 <= code && code <= 599) {
        emoji = "🤒"
      }
      if (emoji !== "") {
        rootObj.set("status_emoji", new JSON.Str(emoji));
      }
    }
  }
  let output = String.UTF8.encode(record.stringify());
  send(output, output.byteLength);
}

export function abort(message: string, fileName: string, line: u32, column: u32): void {
  let buf = String.UTF8.encode(`${message} [${fileName} @ ${line}:${column}]`);
  error(buf, buf.byteLength);
}
