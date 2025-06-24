const std = @import("std");

const autodoc_arch_os_abi = "wasm32-freestanding";
const autodoc_cpu_features = "baseline+atomics+bulk_memory+multivalue+mutable_globals+nontrapping_fptoint+reference_types+sign_ext";

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    try add_zdocs_exe(b, optimize, target);
    try add_update_wasm(b, optimize);
}

fn add_zdocs_exe(b: *std.Build, optimize: std.builtin.OptimizeMode, target: std.Build.ResolvedTarget) !void {
    const exe = b.addExecutable(.{
        .name = "zdocs",
        .root_source_file = b.path("src/main.zig"),
        .optimize = optimize,
        .target = target,
    });

    const is_embed = b.option(bool, "embed", "embed docs file") orelse (optimize != .Debug);
    const exe_options = b.addOptions();
    exe.root_module.addOptions("build_options", exe_options);

    exe_options.addOption(bool, "embed", is_embed);

    const run = b.addRunArtifact(exe);
    if (b.args) |args| {
        run.addArgs(args);
    }
    const run_step = b.step("run", "run zdocs");
    run_step.dependOn(&run.step);

    b.getInstallStep().dependOn(&b.addInstallArtifact(exe, .{}).step);
}

fn add_update_wasm(b: *std.Build, optimize: std.builtin.OptimizeMode) !void {
    const wasm = b.addExecutable(.{
        .name = "main",
        .root_source_file = b.path("src/wasm/main.zig"),
        .optimize = optimize,
        .target = b.resolveTargetQuery(std.Target.Query.parse(.{
            .arch_os_abi = autodoc_arch_os_abi,
            .cpu_features = autodoc_cpu_features,
        }) catch unreachable),
    });
    wasm.entry = .disabled;
    wasm.rdynamic = true;

    const copy_wasm = b.addUpdateSourceFiles();
    copy_wasm.addCopyFileToSource(wasm.getEmittedBin(), "docs/main.wasm");

    const update_wasm_step = b.step("update-wasm", "update docs/main.wasm");
    update_wasm_step.dependOn(&copy_wasm.step);
}
