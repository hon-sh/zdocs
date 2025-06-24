# zdocs

zdocs is like `zig std`, but for all modules.

## examples

std

```bash
zdocs -Mstd
```

module

```bash
zdocs -Mmarkdown=src/wasm/markdown.zig
```

## dev

```bash
zig build run -- -Mstd
```
