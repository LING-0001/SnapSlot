import Foundation
import Vision
import ImageIO

enum TextRecognition {
    private static let queue = DispatchQueue(label: "app.snapslot.ocr", qos: .userInitiated)

    static func recognize(fileURL: URL, completion: @escaping (Result<String, Error>) -> Void) {
        queue.async {
            guard let source = CGImageSourceCreateWithURL(fileURL as CFURL, nil),
                  let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
                DispatchQueue.main.async {
                    completion(.failure(NSError(domain: "SnapSlot.OCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "err.invalidImage"])))
                }
                return
            }
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.automaticallyDetectsLanguage = true
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
                let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
                let text = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
                DispatchQueue.main.async { completion(.success(text)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(error)) }
            }
        }
    }
}
