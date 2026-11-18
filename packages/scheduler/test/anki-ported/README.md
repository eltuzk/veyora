# anki-ported — DO NOT EDIT TO MAKE TESTS PASS

Tests in this folder are line-by-line ports of the `#[cfg(test)]` blocks in
Anki's `rslib/src/scheduler/states/*.rs`. They are the answer key.

- A failing test here means the implementation is wrong. Fix `src/`.
- If you believe a ported test itself is wrong: STOP, explain why, and ask the user.
