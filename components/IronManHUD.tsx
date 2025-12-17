'use client'

import React, { useRef, useEffect, useState } from 'react'
import { theme } from '../lib/theme'

interface ElementBound {
  selector: string
  bounds: { x: number; y: number; width: number; height: number }
  type: string
  text?: string
  interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
}

interface IronManHUDProps {
  screenshotUrl: string
  elementBounds?: ElementBound[]
  targetElementBounds?: {
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
  }
  showAll?: boolean // Show all elements or just the target
  highlightedStepId?: string | null // NEW: Highlight specific element when hovering log
  className?: string
}

/**
 * Iron Man HUD - Visual Annotations Overlay
 * Draws bounding boxes over screenshots to show what the AI analyzed
 * 
 * Color Legend:
 * - Green: Successfully clicked elements
 * - Blue: Successfully typed elements
 * - Yellow: Analyzed but not interacted
 * - Red: Failed interaction
 * - Purple: Self-healed element
 */
export function IronManHUD({
  screenshotUrl,
  elementBounds = [],
  targetElementBounds,
  showAll = false,
  highlightedStepId = null,
  className = '',
}: IronManHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [displayedSize, setDisplayedSize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 })
  const [hoveredElement, setHoveredElement] = useState<ElementBound | null>(null)
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const [pulseAnimation, setPulseAnimation] = useState(0)

  // Load image and calculate dimensions
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // Allow CORS for images
    img.onload = () => {
      setDimensions({ width: img.width, height: img.height })
    }
    img.onerror = (error) => {
      console.error('IronManHUD: Failed to load image:', screenshotUrl, error)
      // Set default dimensions to prevent rendering issues
      setDimensions({ width: 800, height: 600 })
    }
    img.src = screenshotUrl
    imageRef.current = img
  }, [screenshotUrl])

  // Calculate displayed image size when container or dimensions change
  useEffect(() => {
    if (!containerRef.current || dimensions.width === 0 || dimensions.height === 0) return

    const container = containerRef.current
    const containerWidth = container.offsetWidth
    const containerHeight = container.offsetHeight
    const imageAspect = dimensions.width / dimensions.height
    const containerAspect = containerWidth / containerHeight
    
    let displayedWidth: number
    let displayedHeight: number
    let offsetX = 0
    let offsetY = 0
    
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width
      displayedWidth = containerWidth
      displayedHeight = containerWidth / imageAspect
      offsetY = (containerHeight - displayedHeight) / 2
    } else {
      // Image is taller - fit to height
      displayedHeight = containerHeight
      displayedWidth = containerHeight * imageAspect
      offsetX = (containerWidth - displayedWidth) / 2
    }

    setDisplayedSize({ width: displayedWidth, height: displayedHeight, offsetX, offsetY })
  }, [dimensions, containerRef])

  // Pulse animation for highlighted elements
  useEffect(() => {
    if (!highlightedStepId) return
    
    const interval = setInterval(() => {
      setPulseAnimation(prev => (prev + 0.1) % (Math.PI * 2))
    }, 50)
    
    return () => clearInterval(interval)
  }, [highlightedStepId])

  // Draw annotations on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    
    // Wait for dimensions and displayed size to be set
    if (dimensions.width === 0 || dimensions.height === 0 || displayedSize.width === 0) {
      // Clear canvas while waiting
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    // Set canvas size to match displayed image size
    canvas.width = displayedSize.width
    canvas.height = displayedSize.height

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scale factor for coordinates (should be same for both dimensions due to aspect ratio preservation)
    const scaleX = displayedSize.width / dimensions.width
    const scaleY = displayedSize.height / dimensions.height
    const scale = Math.min(scaleX, scaleY) // Use min to ensure proper scaling

    // Helper to draw a box with label
    const drawBox = (
      bounds: { x: number; y: number; width: number; height: number },
      color: string,
      label: string,
      lineWidth: number = 2,
      isHighlighted: boolean = false
    ) => {
      const x = bounds.x * scale
      const y = bounds.y * scale
      const w = bounds.width * scale
      const h = bounds.height * scale

      // Draw pulsing glow for highlighted elements
      if (isHighlighted) {
        const pulseSize = 4 + Math.sin(pulseAnimation) * 3
        ctx.strokeStyle = `${color}80`
        ctx.lineWidth = lineWidth + pulseSize
        ctx.strokeRect(x - pulseSize/2, y - pulseSize/2, w + pulseSize, h + pulseSize)
      }

      // Draw box
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.strokeRect(x, y, w, h)

      // Draw semi-transparent fill on hover or highlight
      if ((hoveredElement && label.includes(hoveredElement.selector)) || isHighlighted) {
        ctx.fillStyle = isHighlighted ? `${color}30` : `${color}20`
        ctx.fillRect(x, y, w, h)
      }

      // Draw label background
      ctx.font = '12px monospace'
      const textMetrics = ctx.measureText(label)
      const textHeight = 16
      const padding = 4

      ctx.fillStyle = color
      ctx.fillRect(
        x,
        Math.max(0, y - textHeight - padding),
        textMetrics.width + padding * 2,
        textHeight + padding
      )

      // Draw label text
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + padding, Math.max(textHeight - 2, y - padding - 2))
    }

    // Draw all elements (if showAll is true)
    if (showAll && elementBounds.length > 0) {
      elementBounds.forEach((el) => {
        let color = '#FFA500' // Default: yellow (analyzed)
        let label = `${el.type}: ${el.selector.substring(0, 30)}`

        // Skip if this is the target element (we'll draw it separately with emphasis)
        if (targetElementBounds && el.selector === targetElementBounds.selector) {
          return
        }

        // Set color based on interaction type
        switch (el.interactionType) {
          case 'clicked':
            color = '#10B981' // Green
            label = `✓ Clicked: ${el.text || el.selector.substring(0, 25)}`
            break
          case 'typed':
            color = '#3B82F6' // Blue
            label = `⌨ Typed: ${el.text || el.selector.substring(0, 25)}`
            break
          case 'healed':
            color = '#9333EA' // Purple
            label = `🔧 Healed: ${el.text || el.selector.substring(0, 25)}`
            break
          case 'failed':
            color = '#EF4444' // Red
            label = `✗ Failed: ${el.text || el.selector.substring(0, 25)}`
            break
          default:
            color = '#FCD34D' // Yellow
            label = `👁 Analyzed: ${el.text || el.selector.substring(0, 20)}`
        }

        const isHighlighted = highlightedStepId === el.selector
        drawBox(el.bounds, color, label, 1, isHighlighted)
      })
    }

    // Draw target element (always with emphasis)
    if (targetElementBounds) {
      let color = '#10B981' // Default: green (success)
      let label = `Target: ${targetElementBounds.selector.substring(0, 30)}`
      let lineWidth = 3

      switch (targetElementBounds.interactionType) {
        case 'clicked':
          color = '#10B981' // Green
          label = `✓ CLICKED: ${targetElementBounds.selector.substring(0, 25)}`
          break
        case 'typed':
          color = '#3B82F6' // Blue
          label = `⌨ TYPED: ${targetElementBounds.selector.substring(0, 25)}`
          break
        case 'healed':
          color = '#9333EA' // Purple
          label = `🔧 HEALED: ${targetElementBounds.selector.substring(0, 25)}`
          break
        case 'failed':
          color = '#EF4444' // Red
          label = `✗ FAILED: ${targetElementBounds.selector.substring(0, 25)}`
          break
        default:
          color = '#FCD34D' // Yellow
          label = `👁 ANALYZED: ${targetElementBounds.selector.substring(0, 25)}`
      }

      const isHighlighted = highlightedStepId === targetElementBounds.selector
      drawBox(targetElementBounds.bounds, color, label, lineWidth, isHighlighted)

      // Add pulsing animation for target (draw outer glow)
      const pulseOffset = 4
      ctx.strokeStyle = `${color}60`
      ctx.lineWidth = 6
      ctx.strokeRect(
        (targetElementBounds.bounds.x - pulseOffset) * scale,
        (targetElementBounds.bounds.y - pulseOffset) * scale,
        (targetElementBounds.bounds.width + pulseOffset * 2) * scale,
        (targetElementBounds.bounds.height + pulseOffset * 2) * scale
      )
    }
  }, [dimensions, elementBounds, targetElementBounds, showAll, hoveredElement, highlightedStepId, pulseAnimation, displayedSize])

  // Handle mouse move for hover effects
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !showAll || dimensions.width === 0 || dimensions.height === 0) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    
    // Calculate displayed image size (same logic as in canvas drawing)
    const containerWidth = container.offsetWidth
    const containerHeight = container.offsetHeight
    const imageAspect = dimensions.width / dimensions.height
    const containerAspect = containerWidth / containerHeight
    
    let displayedWidth: number
    let displayedHeight: number
    let offsetX = 0
    let offsetY = 0
    
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width
      displayedWidth = containerWidth
      displayedHeight = containerWidth / imageAspect
      offsetY = (containerHeight - displayedHeight) / 2
    } else {
      // Image is taller - fit to height
      displayedHeight = containerHeight
      displayedWidth = containerHeight * imageAspect
      offsetX = (containerWidth - displayedWidth) / 2
    }

    // Adjust mouse coordinates relative to displayed image
    const x = e.clientX - rect.left - offsetX
    const y = e.clientY - rect.top - offsetY

    setCursorPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })

    // Calculate scale factor
    const scale = displayedWidth / dimensions.width

    const hovered = elementBounds.find((el) => {
      const scaledX = el.bounds.x * scale
      const scaledY = el.bounds.y * scale
      const scaledW = el.bounds.width * scale
      const scaledH = el.bounds.height * scale

      return x >= scaledX && x <= scaledX + scaledW && y >= scaledY && y <= scaledY + scaledH
    })

    setHoveredElement(hovered || null)
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredElement(null)}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Screenshot */}
      <img
        src={screenshotUrl}
        alt="Test screenshot"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
        crossOrigin="anonymous"
      />

      {/* Canvas overlay for annotations */}
      <canvas
        ref={canvasRef}
        width={dimensions.width || 800}
        height={dimensions.height || 600}
        className="absolute pointer-events-none"
        style={{
          imageRendering: 'crisp-edges',
          width: displayedSize.width || 'auto',
          height: displayedSize.height || 'auto',
          left: displayedSize.offsetX || 0,
          top: displayedSize.offsetY || 0,
        }}
      />

      {/* Legend */}
      <div className="absolute top-2 right-2 text-xs p-2 rounded space-y-1 font-mono" style={{
        backgroundColor: 'rgba(250, 249, 247, 0.95)',
        color: 'var(--text-primary)',
        border: '1px solid var(--beige-300)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div className="font-bold mb-1">🎯 Iron Man HUD</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 border border-white"></div>
          <span>Clicked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 border border-white"></div>
          <span>Typed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 border border-white"></div>
          <span>Healed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 border border-white"></div>
          <span>Analyzed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 border border-white"></div>
          <span>Failed</span>
        </div>
      </div>

      {/* Tooltip on hover */}
      {hoveredElement && (
        <div
          className="absolute text-xs p-2 rounded pointer-events-none z-50"
          style={{
            backgroundColor: 'rgba(250, 249, 247, 0.95)',
            color: 'var(--text-primary)',
            border: '1px solid var(--beige-300)',
            boxShadow: 'var(--shadow-md)',
          }}
          style={{
            left: cursorPosition.x + 10,
            top: cursorPosition.y + 10,
          }}
        >
          <div className="font-bold">{hoveredElement.type.toUpperCase()}</div>
          <div className="text-gray-300">Selector: {hoveredElement.selector}</div>
          {hoveredElement.text && <div className="text-gray-300">Text: {hoveredElement.text}</div>}
          {hoveredElement.interactionType && (
            <div className="mt-1 text-yellow-300">Action: {hoveredElement.interactionType}</div>
          )}
        </div>
      )}
    </div>
  )
}

