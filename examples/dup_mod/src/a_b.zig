const std = @import("std");

pub fn say() !void {
    std.debug.print("hi from a_b. ", .{});
}

test "main" {
    try std.testing.expect(true);
}
