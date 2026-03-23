import React from 'react'

// ---------------------------------------------------------------------------
// SkeletonBlock
//
// A single placeholder block using the global .io-skeleton shimmer animation
// (defined in index.css). Use to compose module-shaped loading skeletons.
// ---------------------------------------------------------------------------

interface SkeletonBlockProps {
  width?: string
  height?: string
  borderRadius?: string
  style?: React.CSSProperties
}

export function SkeletonBlock({
  width = '100%',
  height = '16px',
  borderRadius = '4px',
  style,
}: SkeletonBlockProps) {
  return (
    <div
      className="io-skeleton"
      style={{
        width,
        height,
        borderRadius,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
