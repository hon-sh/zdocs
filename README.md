# zdocs

zdocs is like `zig std`, but for all modules.

## usage

show docs of std

```bash
zdocs -Mstd
```

show docs of specific module

```bash
zdocs -Mmarkdown=src/wasm/markdown.zig
```

## dev

```bash
zig build run -- -Mstd
```
