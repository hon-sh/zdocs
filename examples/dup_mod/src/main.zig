pub fn main() !void {
    try @import("a").say();
    try @import("b").say();
}
