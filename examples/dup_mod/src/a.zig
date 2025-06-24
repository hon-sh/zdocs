const std = @import("std");

pub fn say() !void {
    std.debug.print("hi from a. ", .{});

    try @import("b").say();
}

test "main" {
    _ = @import("b");

    try std.testing.expect(true);
}
