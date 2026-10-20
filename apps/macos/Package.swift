// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "SnapSlot", platforms: [.macOS(.v13)], products: [.executable(name: "SnapSlot", targets: ["SnapSlot"])], targets: [
    .target(name: "SnapSlotCore"),
    .executableTarget(name: "SnapSlot", dependencies: ["SnapSlotCore"], linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit"), .linkedFramework("Carbon")]),
    .executableTarget(name: "SnapSlotCoreChecks", dependencies: ["SnapSlotCore"], path: "Tests/CoreChecks")
])
