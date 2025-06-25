const std = @import("std");

pub fn say() !void {
    std.debug.print("hi from a.\n", .{});

    try @import("b").say();
}
