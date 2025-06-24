# zdocs

![zig 0.14.x](https://img.shields.io/badge/zig-0.14.x-eeeeee?logo=zig)

zdocs is like [zig std](https://ziglang.org/documentation/0.14.1/std/), but for all zig modules.

https://github.com/user-attachments/assets/37369d10-da89-4c59-9bf3-639784d880fa

## usage

show docs of std

```bash
zdocs -Mstd
```

show docs of specific module

```bash
zdocs -Mmarkdown=src/wasm/markdown.zig
```

usage `zdocs -h`

```
Usage: zdocs [options]

Options:
  -h, --help                Print this help and exit.
  -Mstd                     std Module.
  -M<mod_name>=<src_path>   Module name and module root source path.
  --host <host>             Host to listen on. Default is 127.0.0.1.
  -p <port>, --port <port>  Port to listen on. Default is 0, meaning an ephemeral port
                            chosen by the system.
  --[no-]open-browser       Force enabling or disabling opening a browser tab to the
                            served website. By default, enabled unless a port is specified.
```

## install

```bash
# 1. get source code (clone or download)

# 2. install
zig build install -Doptimize=ReleaseSafe -p <your-install-prefix>
```

> `<your-install-prefix>` is the directory where you want to install the `zdocs` binary to, e.g.,<br/>
> `-p /usr/local` will install to `/usr/local/bin/zdocs` or <br>
> `-p ~/.local` will install to `~/.local/bin/zdocs`.

## dev

```bash
zig build run -- -Mstd
```
