import Foundation
import SnapSlotCore

enum UpdateChecker {
    struct Outcome {
        let status: String
        let currentVersion: String
        let latestVersion: String?
        let releaseUrl: String?
        let message: String?
    }

    private static let endpoint = URL(string: "https://api.github.com/repos/LING-0001/SnapSlot/releases/latest")!

    static func isAllowedExternalURL(_ raw: String) -> URL? {
        guard let url = URL(string: raw), url.scheme == "https", let host = url.host?.lowercased() else { return nil }
        if host == "github.com" && url.path.hasPrefix("/LING-0001/SnapSlot") { return url }
        if host == "snapslot.linglinglab.top" { return url }
        return nil
    }

    static func check(currentVersion: String, completion: @escaping (Outcome) -> Void) {
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        request.setValue("SnapSlot/\(currentVersion)", forHTTPHeaderField: "User-Agent")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        URLSession.shared.dataTask(with: request) { data, response, error in
            let finish: (Outcome) -> Void = { outcome in
                DispatchQueue.main.async { completion(outcome) }
            }
            guard error == nil,
                  let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let tag = json["tag_name"] as? String else {
                finish(Outcome(status: "error", currentVersion: currentVersion, latestVersion: nil, releaseUrl: nil, message: nil))
                return
            }
            let releaseURL = (json["html_url"] as? String).flatMap { isAllowedExternalURL($0)?.absoluteString }
                ?? "https://github.com/LING-0001/SnapSlot/releases"
            if SemVer.isNewer(tag, than: currentVersion) {
                finish(Outcome(status: "available", currentVersion: currentVersion, latestVersion: tag, releaseUrl: releaseURL, message: nil))
            } else {
                finish(Outcome(status: "upToDate", currentVersion: currentVersion, latestVersion: tag, releaseUrl: releaseURL, message: nil))
            }
        }.resume()
    }
}
