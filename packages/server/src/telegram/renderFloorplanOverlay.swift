import AppKit
import Foundation

struct Arguments {
  let inputPath: String
  let outputPath: String
  let xPct: Double?
  let yPct: Double?
  let confidence: String?
  let shouldDrawGrid: Bool
  let shouldRedactAddress: Bool
}

func parseArguments() -> Arguments? {
  let args = CommandLine.arguments.dropFirst()
  guard args.count >= 2 else {
    return nil
  }

  let values = Array(args)
  let shouldDrawGrid = values.contains("--grid")
  let shouldRedactAddress = values.contains("--redact-address")
  let coordinateValues = values.filter { $0 != "--grid" && $0 != "--redact-address" }
  let xPct = coordinateValues.count >= 4 ? Double(coordinateValues[2]) : nil
  let yPct = coordinateValues.count >= 4 ? Double(coordinateValues[3]) : nil
  let confidence = coordinateValues.count >= 5 ? coordinateValues[4] : nil

  return Arguments(
    inputPath: coordinateValues[0],
    outputPath: coordinateValues[1],
    xPct: xPct,
    yPct: yPct,
    confidence: confidence,
    shouldDrawGrid: shouldDrawGrid,
    shouldRedactAddress: shouldRedactAddress
  )
}

guard let arguments = parseArguments() else {
  FileHandle.standardError.write(
    Data("usage: renderFloorplanOverlay.swift input output [xPct yPct confidence] [--grid] [--redact-address]\n".utf8)
  )
  exit(2)
}

guard
  let image = NSImage(contentsOfFile: arguments.inputPath),
  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  FileHandle.standardError.write(Data("failed to read input image\n".utf8))
  exit(1)
}

let width = cgImage.width
let height = cgImage.height
let rect = NSRect(x: 0, y: 0, width: width, height: height)

guard
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ),
  let context = NSGraphicsContext(bitmapImageRep: bitmap)
else {
  FileHandle.standardError.write(Data("failed to create output bitmap\n".utf8))
  exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor.white.setFill()
rect.fill()
NSImage(cgImage: cgImage, size: rect.size).draw(in: rect)

func topDownY(_ yPct: Double) -> CGFloat {
  return CGFloat(height) * CGFloat(1.0 - yPct / 100.0)
}

func drawGrid() {
  let path = NSBezierPath()
  path.lineWidth = max(1.0, CGFloat(width) / 1_000.0)
  NSColor(calibratedRed: 0.0, green: 0.25, blue: 1.0, alpha: 0.32).setStroke()

  for index in 0...10 {
    let x = CGFloat(width) * CGFloat(index) / 10.0
    path.move(to: NSPoint(x: x, y: 0))
    path.line(to: NSPoint(x: x, y: CGFloat(height)))

    let y = CGFloat(height) * CGFloat(index) / 10.0
    path.move(to: NSPoint(x: 0, y: y))
    path.line(to: NSPoint(x: CGFloat(width), y: y))
  }

  path.stroke()

  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = .center
  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.boldSystemFont(ofSize: max(9.0, CGFloat(width) / 70.0)),
    .foregroundColor: NSColor(calibratedRed: 0.0, green: 0.12, blue: 0.65, alpha: 0.78),
    .backgroundColor: NSColor(calibratedWhite: 1.0, alpha: 0.68),
    .paragraphStyle: paragraph,
  ]

  for index in 0...10 {
    let pct = index * 10
    let x = CGFloat(width) * CGFloat(index) / 10.0
    let y = topDownY(Double(pct))
    let labelSize = NSSize(width: max(34.0, CGFloat(width) / 26.0), height: max(16.0, CGFloat(width) / 80.0))
    let labelX = min(max(0.0, x - labelSize.width / 2.0), CGFloat(width) - labelSize.width)
    let labelY = min(max(0.0, y - labelSize.height / 2.0), CGFloat(height) - labelSize.height)

    NSString(string: "x\(pct)").draw(
      in: NSRect(x: labelX, y: CGFloat(height) - labelSize.height - 2.0, width: labelSize.width, height: labelSize.height),
      withAttributes: attributes
    )

    NSString(string: "y\(pct)").draw(
      in: NSRect(x: 2.0, y: labelY, width: labelSize.width, height: labelSize.height),
      withAttributes: attributes
    )
  }
}

func redactAddress() {
  let redactionRect = NSRect(
    x: CGFloat(width) * 0.025,
    y: CGFloat(height) * 0.895,
    width: CGFloat(width) * 0.56,
    height: CGFloat(height) * 0.105
  )
  NSColor(calibratedWhite: 1.0, alpha: 1.0).setFill()
  redactionRect.fill()
}

func drawPositionDot(xPct: Double, yPct: Double, confidence: String?) {
  let x = CGFloat(width) * CGFloat(xPct / 100.0)
  let y = topDownY(yPct)
  let radius = max(14.0, CGFloat(width) / 48.0)
  let dotRect = NSRect(x: x - radius, y: y - radius, width: radius * 2.0, height: radius * 2.0)

  let shadow = NSShadow()
  shadow.shadowBlurRadius = radius * 0.28
  shadow.shadowOffset = NSSize(width: 0, height: -radius * 0.08)
  shadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.45)
  shadow.set()

  NSColor(calibratedRed: 1.0, green: 0.08, blue: 0.02, alpha: 0.88).setFill()
  NSBezierPath(ovalIn: dotRect).fill()
  NSGraphicsContext.current?.cgContext.setShadow(offset: .zero, blur: 0)

  let outline = NSBezierPath(ovalIn: dotRect)
  outline.lineWidth = max(8.0, radius * 0.16)
  NSColor.white.setStroke()
  outline.stroke()

  let label = "Herbert \(Int(xPct)),\(Int(yPct))" + (confidence.map { " \($0)" } ?? "")
  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.boldSystemFont(ofSize: max(10.0, CGFloat(width) / 72.0)),
    .foregroundColor: NSColor.white,
    .backgroundColor: NSColor(calibratedWhite: 0.0, alpha: 0.62),
  ]
  NSString(string: label).draw(
    at: NSPoint(x: min(max(12.0, x + radius * 0.8), CGFloat(width) - radius * 4.0), y: min(max(12.0, y + radius * 0.8), CGFloat(height) - radius)),
    withAttributes: attributes
  )
}

if arguments.shouldRedactAddress {
  redactAddress()
}

if arguments.shouldDrawGrid {
  drawGrid()
}

if let xPct = arguments.xPct, let yPct = arguments.yPct {
  drawPositionDot(xPct: xPct, yPct: yPct, confidence: arguments.confidence)
}

NSGraphicsContext.restoreGraphicsState()

guard let outputData = bitmap.representation(using: .png, properties: [:]) else {
  FileHandle.standardError.write(Data("failed to encode output image\n".utf8))
  exit(1)
}

do {
  try FileManager.default.createDirectory(
    at: URL(fileURLWithPath: arguments.outputPath).deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
  try outputData.write(to: URL(fileURLWithPath: arguments.outputPath))
} catch {
  FileHandle.standardError.write(Data("failed to write output image: \(error)\n".utf8))
  exit(1)
}
