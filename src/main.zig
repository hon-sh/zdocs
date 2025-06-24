//! from zig/lib/compiler/std-docs.zig (6d1f0eca77)

const builtin = @import("builtin");
const std = @import("std");
const mem = std.mem;
const io = std.io;
const Allocator = std.mem.Allocator;
const assert = std.debug.assert;
const Cache = std.Build.Cache;

const print = std.debug.print;
const log = std.log.scoped(.zdocs);

const is_embed: bool = @import("build_options").embed;

fn usage(status: u8) noreturn {
    io.getStdOut().writeAll(
        \\Usage: zdocs [options]
        \\
        \\Options:
        \\  -h, --help                Print this help and exit.
        \\  -Mstd                     std Module.
        \\  -M<mod_name>=<src_path>   Module name and module root source path.
        \\  --host <host>             Host to listen on. Default is 127.0.0.1.
        \\  -p <port>, --port <port>  Port to listen on. Default is 0, meaning an ephemeral port chosen by the system.
        \\  --[no-]open-browser       Force enabling or disabling opening a browser tab to the served website.
        \\                            By default, enabled unless a port is specified.
        \\
    ) catch {};
    std.process.exit(status);
}

pub fn main() !void {
    var arena_instance = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena_instance.deinit();
    const arena = arena_instance.allocator();

    var general_purpose_allocator: std.heap.GeneralPurposeAllocator(.{}) = .init;
    const gpa = general_purpose_allocator.allocator();

    log.debug("is_embed: {}", .{is_embed});

    var argv = try std.process.argsWithAllocator(arena);
    defer argv.deinit();
    assert(argv.skip());

    const opt_lib_dir = try getZigLibDir(gpa);
    defer {
        if (opt_lib_dir) |lib_dir| {
            @constCast(&lib_dir).close();
        }
    }

    var mod_src_path: []const u8 = "";
    var mod_name: []const u8 = "";

    var listen_port: u16 = 0;
    var listen_host: []const u8 = "127.0.0.1";
    var force_open_browser: ?bool = null;
    while (argv.next()) |arg| {
        log.debug("arg: '{s}'", .{arg});

        if (mem.eql(u8, arg, "-h") or mem.eql(u8, arg, "--help")) {
            usage(0);
        } else if (mem.eql(u8, arg, "-h") or mem.eql(u8, arg, "--host")) {
            listen_host = argv.next() orelse usage(1);
        } else if (mem.eql(u8, arg, "-p") or mem.eql(u8, arg, "--port")) {
            listen_port = std.fmt.parseInt(u16, argv.next() orelse usage(1), 10) catch |err| {
                std.log.err("expected port number: {}", .{err});
                usage(1);
            };
        } else if (mem.startsWith(u8, arg, "-M")) {
            // TODO: check multiple -M
            var it = mem.splitScalar(u8, arg["-M".len..], '=');
            mod_name = it.next().?;
            mod_src_path = it.next() orelse d: {
                if (mem.eql(u8, mod_name, "std")) {
                    if (opt_lib_dir) |lib_dir| {
                        break :d try lib_dir.realpathAlloc(gpa, "std/std.zig");
                    }
                    fatal("-Mstd need zig installed, you can use -Mstd=<path-to-std/std.zig> instead", .{});
                }
                fatal("expected module root_src_path after -M{s}", .{mod_name});
            };
        } else if (mem.eql(u8, arg, "--open-browser")) {
            force_open_browser = true;
        } else if (mem.eql(u8, arg, "--no-open-browser")) {
            force_open_browser = false;
        } else {
            std.log.err("unrecognized argument: {s}", .{arg});
            usage(1);
        }
    }
    const should_open_browser = force_open_browser orelse (listen_port == 0);

    if (mod_name.len == 0) {
        std.log.err("-M required", .{});
        usage(1);
    }

    const address = std.net.Address.parseIp(listen_host, listen_port) catch unreachable;
    var http_server = try address.listen(.{});
    const port = http_server.listen_address.in.getPort();
    const url_with_newline = try std.fmt.allocPrint(arena, "http://127.0.0.1:{d}/\n", .{port});
    // const url_with_newline = try std.fmt.allocPrint(arena, "http://{}/\n", .{http_server.listen_address.in});
    std.io.getStdOut().writeAll(url_with_newline) catch {};
    if (should_open_browser) {
        openBrowserTab(gpa, url_with_newline[0 .. url_with_newline.len - 1 :'\n']) catch |err| {
            std.log.err("unable to open browser: {s}", .{@errorName(err)});
        };
    }

    var context: Context = .{
        .gpa = gpa,
        .mod_src_path = mod_src_path,
        .mod_name = mod_name,
    };

    while (true) {
        const connection = try http_server.accept();
        _ = std.Thread.spawn(.{}, accept, .{ &context, connection }) catch |err| {
            std.log.err("unable to accept connection: {s}", .{@errorName(err)});
            connection.stream.close();
            continue;
        };
    }
}

fn accept(context: *Context, connection: std.net.Server.Connection) void {
    defer connection.stream.close();

    var read_buffer: [8000]u8 = undefined;
    var server = std.http.Server.init(connection, &read_buffer);
    while (server.state == .ready) {
        var request = server.receiveHead() catch |err| switch (err) {
            error.HttpConnectionClosing => return,
            else => {
                std.log.err("closing http connection: {s}", .{@errorName(err)});
                return;
            },
        };
        serveRequest(&request, context) catch |err| {
            std.log.err("unable to serve {s}: {s}", .{ request.head.target, @errorName(err) });
            return;
        };
    }
}

const Context = struct {
    gpa: Allocator,
    mod_src_path: []const u8,
    mod_name: []const u8,
};

fn serveRequest(request: *std.http.Server.Request, context: *Context) !void {
    if (std.mem.eql(u8, request.head.target, "/")) {
        try serveDocsFile(request, context, .index_html, "text/html");
    } else if (std.mem.eql(u8, request.head.target, "/main.js")) {
        try serveDocsFile(request, context, .main_js, "application/javascript");
    } else if (std.mem.eql(u8, request.head.target, "/main.wasm")) {
        try serveDocsFile(request, context, .main_wasm, "application/wasm");
    } else if (std.mem.eql(u8, request.head.target, "/sources.tar")) {
        try serveSourcesTar(request, context);
    } else {
        try request.respond("not found", .{
            .status = .not_found,
            .extra_headers = &.{
                .{ .name = "content-type", .value = "text/plain" },
            },
        });
    }
}

const cache_control_header: std.http.Header = .{
    .name = "cache-control",
    .value = "max-age=0, must-revalidate",
};

const DocFile = enum {
    index_html,
    main_js,
    main_wasm,

    fn name(self: DocFile) []const u8 {
        return switch (self) {
            .index_html => "src/docs/index.html",
            .main_js => "src/docs/main.js",
            .main_wasm => "src/docs/main.wasm",
        };
    }

    fn embed(self: DocFile) []const u8 {
        if (comptime is_embed) {
            return switch (self) {
                .index_html => @embedFile("docs/index.html"),
                .main_js => @embedFile("docs/main.js"),
                .main_wasm => @embedFile("docs/main.wasm"),
            };
        } else {
            unreachable;
        }
    }
};

fn serveDocsFile(
    request: *std.http.Server.Request,
    context: *Context,
    file: DocFile,
    content_type: []const u8,
) !void {
    const gpa = context.gpa;
    const file_contents = c: {
        if (is_embed) {
            break :c file.embed();
        } else {
            break :c try std.fs.cwd().readFileAlloc(gpa, file.name(), 10 * 1024 * 1024);
        }
    };
    defer {
        if (!is_embed) {
            gpa.free(file_contents);
        }
    }
    try request.respond(file_contents, .{
        .extra_headers = &.{
            .{ .name = "content-type", .value = content_type },
            cache_control_header,
        },
    });
}

fn serveSourcesTar(request: *std.http.Server.Request, context: *Context) !void {
    const gpa = context.gpa;

    var send_buffer: [0x4000]u8 = undefined;
    var response = request.respondStreaming(.{
        .send_buffer = &send_buffer,
        .respond_options = .{
            .extra_headers = &.{
                .{ .name = "content-type", .value = "application/x-tar" },
                cache_control_header,
            },
        },
    });

    // TODO: dirname ?
    var mod_dir = try std.fs.cwd().openDir(std.fs.path.dirname(context.mod_src_path).?, .{ .iterate = true });
    defer mod_dir.close();

    var walker = try mod_dir.walk(gpa);
    defer walker.deinit();

    var archiver = std.tar.writer(response.writer());
    archiver.prefix = context.mod_name;

    while (try walker.next()) |entry| {
        switch (entry.kind) {
            .file => {
                if (!std.mem.endsWith(u8, entry.basename, ".zig"))
                    continue;
                if (std.mem.endsWith(u8, entry.basename, "test.zig"))
                    continue;
            },
            else => continue,
        }
        var file = try entry.dir.openFile(entry.basename, .{});
        defer file.close();
        try archiver.writeFile(entry.path, file);
    }

    {
        // Since this command is JIT compiled, the builtin module available in
        // this source file corresponds to the user's host system.
        const builtin_zig = @embedFile("builtin");
        archiver.prefix = "builtin";
        try archiver.writeFileBytes("builtin.zig", builtin_zig, .{});
    }

    // intentionally omitting the pointless trailer
    //try archiver.finish();
    try response.end();
}

fn openBrowserTab(gpa: Allocator, url: []const u8) !void {
    // Until https://github.com/ziglang/zig/issues/19205 is implemented, we
    // spawn a thread for this child process.
    _ = try std.Thread.spawn(.{}, openBrowserTabThread, .{ gpa, url });
}

fn openBrowserTabThread(gpa: Allocator, url: []const u8) !void {
    const main_exe = switch (builtin.os.tag) {
        .windows => "explorer",
        .macos => "open",
        else => "xdg-open",
    };
    var child = std.process.Child.init(&.{ main_exe, url }, gpa);
    child.stdin_behavior = .Ignore;
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;
    try child.spawn();
    _ = try child.wait();
}

fn fatal(comptime format: []const u8, args: anytype) noreturn {
    std.log.err(format, args);
    std.process.exit(1);
}

fn getZigLibDir(ally: std.mem.Allocator) !?std.fs.Dir {
    const p = std.process.Child.run(.{
        .allocator = ally,
        .argv = &.{ "zig", "env" },
    }) catch |err| {
        log.debug("run zig env fail: {s}", .{@errorName(err)});
        return null;
    };

    const ZigEnvResult = struct {
        lib_dir: []u8,
    };

    defer {
        ally.free(p.stdout);
        ally.free(p.stderr);
    }

    // print("zig env: {s}\nstderr: {s}\n", .{ p.stdout, p.stderr });

    switch (p.term) {
        .Exited => |code| {
            if (code != 0) {
                log.warn("zig env command exited with code {d}\n stderr: {s}", .{ code, p.stderr });
                return null;
            }
        },
        .Signal, .Stopped, .Unknown => {
            log.warn("zig env command terminated unexpectedly {s}", .{@tagName(p.term)});
            return null;
        },
    }

    const v = try std.json.parseFromSlice(ZigEnvResult, ally, p.stdout, .{
        .ignore_unknown_fields = true,
    });

    defer v.deinit();

    return std.fs.cwd().openDir(v.value.lib_dir, .{}) catch |err| {
        log.warn("unable to open lib dir '{s}': {s}", .{ v.value.lib_dir, @errorName(err) });
        return null;
    };
}
