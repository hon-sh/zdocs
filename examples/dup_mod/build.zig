const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const a_b_mod = b.createModule(.{
        .root_source_file = b.path("src/a_b.zig"),
        .target = target,
        .optimize = optimize,
    });
    const a_mod = b.createModule(.{
        .root_source_file = b.path("src/a.zig"),
        .target = target,
        .optimize = optimize,
    });
    a_mod.addImport("b", a_b_mod);
    const b_mod = b.createModule(.{
        .root_source_file = b.path("src/b.zig"),
        .target = target,
        .optimize = optimize,
    });

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    exe_mod.addImport("a", a_mod);
    exe_mod.addImport("b", b_mod);

    if (b.option(bool, "dump-deps", "dump module dependencies")) |dump_deps| {
        if (dump_deps) {
            std.debug.print("module deps:\n", .{});
            dumpModDeps(exe_mod, "root", b) catch |err| {
                std.debug.print("dumpModDeps err: {s}\n", .{@errorName(err)});
                @panic("dumpModDeps fail");
            };
            std.process.exit(2);
        }
    }

    const exe = b.addExecutable(.{
        .name = "dup_mod",
        .root_module = exe_mod,
    });

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}

fn dumpModDeps(mod: *std.Build.Module, name: []const u8, b: *std.Build) !void {
    std.debug.print("{s}\n", .{name});

    for (mod.import_table.keys(), mod.import_table.values()) |import_name, other_mod| {
        std.debug.print("{s} -> {s} ({s})\n", .{
            name,
            import_name,
            p: {
                const pp = other_mod.root_source_file.?;
                switch (pp) {
                    .src_path, .cwd_relative => {
                        const pwd = try std.fs.cwd().realpathAlloc(b.allocator, ".");
                        break :p try std.fs.path.relative(b.allocator, pwd, pp.getPath(b));
                    },
                    else => {
                        break :p pp.getDisplayName();
                    },
                }
            },
        });
    }

    for (mod.import_table.keys(), mod.import_table.values()) |import_name, other_mod| {
        if (other_mod.import_table.count() > 0) {
            try dumpModDeps(other_mod, try std.fmt.allocPrint(b.allocator, "{s}.{s}", .{ name, import_name }), b);
        }
    }
}
