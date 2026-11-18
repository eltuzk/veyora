# Anki reference

Sparse clone of Anki used as the porting source, kept outside the repo at `../anki-ref`.

- Repo: https://github.com/ankitects/anki
- Commit: `030265096e98b818a2eea5c7a393398094f9ee95` (main, 2026-11-18, "Use relative link to manual")
- Sparse paths checked out: `rslib/src/scheduler`, `rslib/src/deckconfig`
- Paths: `rslib/src/scheduler/states/*.rs`, `rslib/src/scheduler/answering/mod.rs`, `rslib/src/deckconfig/mod.rs`

Suggested clone:

```bash
git clone --filter=blob:none --sparse https://github.com/ankitects/anki ../anki-ref
cd ../anki-ref && git sparse-checkout set rslib/src/scheduler rslib/src/deckconfig
git rev-parse HEAD   # record here
```
