// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "cursor-tracker",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "cursor-tracker",
            path: "Sources/cursor_tracker",
            linkerSettings: [
                .linkedFramework("CoreGraphics"),
                .linkedFramework("AppKit"),
            ]
        )
    ]
)
