// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "face-detector",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "face-detector",
            path: "Sources/face_detector",
            linkerSettings: [
                .linkedFramework("AVFoundation"),
                .linkedFramework("Vision"),
                .linkedFramework("CoreMedia"),
            ]
        )
    ]
)
