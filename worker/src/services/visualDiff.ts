// Visual Diff Service using pixelmatch for pixel-perfect regression testing
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

export interface VisualDiffResult {
  hasDifference: boolean
  diffPercentage: number
  diffImageBuffer?: Buffer
  mismatchedPixels: number
  totalPixels: number
}

export class VisualDiffService {
  private pixelThreshold: number

  constructor(pixelThreshold: number = 0.1) {
    // Threshold for color distance (0-1), higher = more lenient
    this.pixelThreshold = pixelThreshold
  }

  /**
   * Compare two screenshots and generate a diff image
   * @param baselineBuffer - The expected screenshot (baseline)
   * @param currentBuffer - The actual screenshot (current)
   * @returns Visual diff result with percentage and diff image
   */
  async compareScreenshots(
    baselineBuffer: Buffer,
    currentBuffer: Buffer
  ): Promise<VisualDiffResult> {
    try {
      // Parse PNG images
      const baseline = PNG.sync.read(baselineBuffer)
      const current = PNG.sync.read(currentBuffer)

      // Ensure dimensions match
      if (baseline.width !== current.width || baseline.height !== current.height) {
        throw new Error(
          `Image dimensions don't match: baseline(${baseline.width}x${baseline.height}) vs current(${current.width}x${current.height})`
        )
      }

      // Create diff image
      const { width, height } = baseline
      const diff = new PNG({ width, height })

      // Perform pixel-by-pixel comparison
      const mismatchedPixels = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        width,
        height,
        {
          threshold: this.pixelThreshold,
          includeAA: false, // Ignore anti-aliasing
          alpha: 0.1, // Opacity of diff overlay
          diffColor: [255, 0, 255], // Bright pink for differences
        }
      )

      const totalPixels = width * height
      const diffPercentage = (mismatchedPixels / totalPixels) * 100

      // Generate diff image buffer
      const diffImageBuffer = PNG.sync.write(diff)

      console.log(
        `Visual diff: ${mismatchedPixels} / ${totalPixels} pixels differ (${diffPercentage.toFixed(2)}%)`
      )

      return {
        hasDifference: mismatchedPixels > 0,
        diffPercentage,
        diffImageBuffer: mismatchedPixels > 0 ? diffImageBuffer : undefined,
        mismatchedPixels,
        totalPixels,
      }
    } catch (error: any) {
      console.error('Visual diff comparison failed:', error.message)
      throw error
    }
  }

  /**
   * Check if visual difference exceeds acceptable threshold
   * @param diffPercentage - Percentage of different pixels
   * @param acceptableThreshold - Maximum acceptable difference (default 1%)
   * @returns Whether the difference is acceptable
   */
  isAcceptable(diffPercentage: number, acceptableThreshold: number = 1.0): boolean {
    return diffPercentage <= acceptableThreshold
  }

  /**
   * Generate a visual diff report with before/after/diff images
   * @param baselineBuffer - Baseline screenshot
   * @param currentBuffer - Current screenshot
   * @param diffResult - Diff result from compareScreenshots
   * @returns HTML report string
   */
  generateDiffReport(
    baselineBuffer: Buffer,
    currentBuffer: Buffer,
    diffResult: VisualDiffResult
  ): string {
    const baselineBase64 = baselineBuffer.toString('base64')
    const currentBase64 = currentBuffer.toString('base64')
    const diffBase64 = diffResult.diffImageBuffer?.toString('base64') || ''

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: ${diffResult.hasDifference ? '#ef4444' : '#10b981'};">
          ${diffResult.hasDifference ? '❌ Visual Difference Detected' : '✅ Visual Match'}
        </h2>
        <p>
          <strong>Difference:</strong> ${diffResult.diffPercentage.toFixed(4)}% 
          (${diffResult.mismatchedPixels.toLocaleString()} / ${diffResult.totalPixels.toLocaleString()} pixels)
        </p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
          <div>
            <h3 style="margin-top: 0;">Baseline (Expected)</h3>
            <img src="data:image/png;base64,${baselineBase64}" style="width: 100%; border: 2px solid #10b981;" />
          </div>
          <div>
            <h3 style="margin-top: 0;">Current (Actual)</h3>
            <img src="data:image/png;base64,${currentBase64}" style="width: 100%; border: 2px solid #3b82f6;" />
          </div>
          ${diffResult.hasDifference ? `
          <div>
            <h3 style="margin-top: 0;">Difference (Pink = Changed)</h3>
            <img src="data:image/png;base64,${diffBase64}" style="width: 100%; border: 2px solid #ef4444;" />
          </div>
          ` : ''}
        </div>
      </div>
    `
  }
}

