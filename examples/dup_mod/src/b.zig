const std = @import("std");

pub fn say() !void {
    std.debug.print("hi from b.\n", .{});
}
