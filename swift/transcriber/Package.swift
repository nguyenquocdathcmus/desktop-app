// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "transcriber",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "transcriber",
            path: "Sources/transcriber",
            linkerSettings: [
                .linkedFramework("Speech"),
                .linkedFramework("AVFoundation"),
            ]
        )
    ]
)
