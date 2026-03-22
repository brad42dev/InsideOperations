/**
 * RecognitionWizard.tsx
 *
 * Multi-step wizard modal for P&ID / DCS symbol recognition import.
 *
 * Step 1 (upload):   File picker — calls POST /api/recognition/detect
 * Step 2 (review):   Image with SVG bounding-box overlay; accept / reject / correct
 * Step 3 (generate): Generate graphic button — calls POST /api/recognition/generate
 *
 * Graceful degradation: if GET /api/recognition/status shows both domains disabled,
 * the wizard trigger renders an unavailable message instead of the wizard.
 *
 * Permission: requires designer:import (checked by the calling component).
 *
 * Spec: design-docs/26_PID_RECOGNITION.md §Designer Module Integration
 */

import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  recognitionApi,
  type Detection,
  type RecognitionStatus,
  type RecognitionClass,
} from '../../../api/recognition'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 'upload' | 'review' | 'generate'
type Domain = 'pid' | 'dcs'

interface ReviewDetection extends Detection {
  /** Unique index used as a stable key */
  _idx: number
  accepted: boolean
  rejected: boolean
  /** If corrected, the new class name chosen by the user */
  correctedClass?: string
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecognitionWizardProps {
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(confidence: number): string {
  if (confidence > 0.9) return '#22c55e'
  if (confidence >= 0.7) return '#eab308'
  return '#ef4444'
}

function confidenceLabel(confidence: number): string {
  if (confidence > 0.9) return 'High'
  if (confidence >= 0.7) return 'Medium'
  return 'Low'
}

// ---------------------------------------------------------------------------
// Shared wizard shell (modal overlay)
// ---------------------------------------------------------------------------

function WizardShell({
  step,
  children,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  onClose,
}: {
  step: WizardStep
  children: React.ReactNode
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  onClose: () => void
}) {
  const STEPS: WizardStep[] = ['upload', 'review', 'generate']
  const stepIndex = STEPS.indexOf(step)
  const STEP_LABELS = ['Upload', 'Review', 'Generate']

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          width: 760,
          maxWidth: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px',
            borderBottom: '1px solid var(--io-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--io-text-primary)', flex: 1 }}>
            Recognize Image
          </span>
          {/* Step pills */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {STEP_LABELS.map((label, i) => {
              const active = i === stepIndex
              const done = i < stepIndex
              return (
                <React.Fragment key={label}>
                  {i > 0 && (
                    <div style={{ width: 16, height: 1, background: 'var(--io-border)' }} />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 'var(--io-radius)',
                      background: active
                        ? 'var(--io-accent)'
                        : done
                        ? 'rgba(34,197,94,0.15)'
                        : 'var(--io-surface)',
                      color: active
                        ? '#09090b'
                        : done
                        ? '#22c55e'
                        : 'var(--io-text-muted)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <span>{done ? '✓' : i + 1}</span>
                    <span>{label}</span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 4px',
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {children}
        </div>

        {/* Footer */}
        {(onBack || onNext) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 20px',
              borderTop: '1px solid var(--io-border)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                height: 32,
                padding: '0 16px',
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  height: 32,
                  padding: '0 16px',
                  background: 'var(--io-surface)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                disabled={nextDisabled}
                style={{
                  height: 32,
                  padding: '0 16px',
                  background: nextDisabled ? 'var(--io-surface-elevated)' : 'var(--io-accent)',
                  border: 'none',
                  borderRadius: 'var(--io-radius)',
                  color: nextDisabled ? 'var(--io-text-muted)' : '#09090b',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: nextDisabled ? 'not-allowed' : 'pointer',
                  opacity: nextDisabled ? 0.6 : 1,
                }}
              >
                {nextLabel ?? 'Next'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------

interface UploadStepProps {
  onDetected: (imageUrl: string, detections: ReviewDetection[], domain: Domain) => void
  onClose: () => void
}

function UploadStep({ onDetected, onClose }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setError(null)
    }
  }

  async function handleDetect() {
    if (!file) return
    setLoading(true)
    setError(null)

    const result = await recognitionApi.runInference(file, { domain: 'auto' })

    setLoading(false)

    if (!result.success) {
      setError(result.error.message)
      return
    }

    const data = result.data
    const detectedDomain: Domain = (data.domain === 'dcs' ? 'dcs' : 'pid') as Domain
    const reviews: ReviewDetection[] = data.detections.map((d, i) => ({
      ...d,
      _idx: i,
      accepted: true,
      rejected: false,
    }))

    // Build a data URL for the image so we can display it in the review step
    const imageUrl = URL.createObjectURL(file)
    onDetected(imageUrl, reviews, detectedDomain)
  }

  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)
      setError(null)
    }
  }

  return (
    <WizardShell
      step="upload"
      onClose={onClose}
      onNext={file && !loading ? handleDetect : undefined}
      nextLabel={loading ? 'Detecting...' : 'Detect Symbols'}
      nextDisabled={!file || loading}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--io-text-secondary)' }}>
          Upload a P&amp;ID or DCS image to detect symbols. Supported formats: PNG, JPEG, PDF, TIFF.
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--io-accent)' : 'var(--io-border)'}`,
            borderRadius: 'var(--io-radius)',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(99,102,241,0.06)' : 'var(--io-surface)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,.tif,.tiff"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {file ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 32 }}>🖼</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--io-text-primary)' }}>
                {file.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
                {(file.size / 1024).toFixed(0)} KB — click to change
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 32, color: 'var(--io-text-muted)' }}>⬆</span>
              <span style={{ fontSize: 14, color: 'var(--io-text-secondary)' }}>
                Drag and drop or click to select
              </span>
              <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
                PNG, JPEG, PDF, TIFF supported
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'rgba(99,102,241,0.08)',
              borderRadius: 'var(--io-radius)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <SpinnerIcon />
            <span style={{ fontSize: 13, color: 'var(--io-text-secondary)' }}>
              Running symbol detection...
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: '#ef4444',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </WizardShell>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Review
// ---------------------------------------------------------------------------

interface ReviewStepProps {
  imageUrl: string
  detections: ReviewDetection[]
  domain: Domain
  onDetectionsChange: (detections: ReviewDetection[]) => void
  onDomainChange: (domain: Domain) => void
  onBack: () => void
  onNext: () => void
  onClose: () => void
}

function ReviewStep({
  imageUrl,
  detections,
  domain,
  onDetectionsChange,
  onDomainChange,
  onBack,
  onNext,
  onClose,
}: ReviewStepProps) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [classes, setClasses] = useState<RecognitionClass[]>([])
  const [openCorrectionIdx, setOpenCorrectionIdx] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Load class list for corrections
  useEffect(() => {
    recognitionApi.getClasses(domain).then((res) => {
      if (res.success) setClasses(res.data.classes)
    })
  }, [domain])

  function handleImageLoad() {
    const img = imgRef.current
    if (img) {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }

  function setDetection(idx: number, patch: Partial<ReviewDetection>) {
    onDetectionsChange(detections.map((d) => (d._idx === idx ? { ...d, ...patch } : d)))
  }

  function handleAccept(idx: number) {
    setDetection(idx, { accepted: true, rejected: false })
    setOpenCorrectionIdx(null)
  }

  function handleReject(idx: number) {
    setDetection(idx, { accepted: false, rejected: true })
    setOpenCorrectionIdx(null)
  }

  function handleCorrect(idx: number, newClass: string) {
    setDetection(idx, { accepted: true, rejected: false, correctedClass: newClass, class_name: newClass })
    setOpenCorrectionIdx(null)
  }

  const acceptedCount = detections.filter((d) => d.accepted && !d.rejected).length

  // Container dimensions for SVG overlay
  const containerWidth = 680
  const containerHeight = imgSize
    ? Math.round((containerWidth / imgSize.w) * imgSize.h)
    : 400

  return (
    <WizardShell
      step="review"
      onClose={onClose}
      onBack={onBack}
      onNext={onNext}
      nextLabel={`Generate (${acceptedCount} accepted)`}
      nextDisabled={acceptedCount === 0}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Domain selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--io-text-secondary)' }}>
            Domain detected:
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['pid', 'dcs'] as Domain[]).map((d) => (
              <button
                key={d}
                onClick={() => onDomainChange(d)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--io-radius)',
                  border: `1px solid ${domain === d ? 'var(--io-accent)' : 'var(--io-border)'}`,
                  background: domain === d ? 'var(--io-accent)' : 'var(--io-surface)',
                  color: domain === d ? '#09090b' : 'var(--io-text-secondary)',
                  fontSize: 12,
                  fontWeight: domain === d ? 700 : 400,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {d === 'pid' ? 'P&ID' : 'DCS'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
            ({detections.length} symbols detected)
          </span>
        </div>

        {/* Image + SVG overlay */}
        <div
          style={{
            position: 'relative',
            width: containerWidth,
            height: containerHeight,
            maxWidth: '100%',
            background: '#000',
            borderRadius: 'var(--io-radius)',
            overflow: 'hidden',
            alignSelf: 'center',
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Uploaded P&ID / DCS image"
            onLoad={handleImageLoad}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* SVG overlay for bounding boxes */}
          {imgSize && (
            <svg
              viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {detections
                .filter((d) => !d.rejected)
                .map((d) => {
                  const [x1, y1, x2, y2] = d.bbox
                  const bx = x1 * imgSize.w
                  const by = y1 * imgSize.h
                  const bw = (x2 - x1) * imgSize.w
                  const bh = (y2 - y1) * imgSize.h
                  const color = confidenceColor(d.confidence)
                  return (
                    <g key={d._idx}>
                      <rect
                        x={bx}
                        y={by}
                        width={bw}
                        height={bh}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        opacity={d.accepted ? 1 : 0.4}
                      />
                      {/* Label */}
                      <rect
                        x={bx}
                        y={Math.max(0, by - 18)}
                        width={Math.min(bw, 120)}
                        height={16}
                        fill={color}
                        opacity={0.85}
                      />
                      <text
                        x={bx + 3}
                        y={Math.max(0, by - 5)}
                        fontSize={10}
                        fill="#000"
                        fontWeight="bold"
                      >
                        {d.correctedClass ?? d.class_name}
                      </text>
                    </g>
                  )
                })}
            </svg>
          )}
        </div>

        {/* Detection list */}
        <div
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
          }}
        >
          {detections.length === 0 && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--io-text-muted)',
                fontSize: 13,
              }}
            >
              No symbols detected.
            </div>
          )}
          {detections.map((d) => {
            const color = confidenceColor(d.confidence)
            const isOpen = openCorrectionIdx === d._idx
            return (
              <div
                key={d._idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--io-border)',
                  background: d.rejected
                    ? 'rgba(239,68,68,0.05)'
                    : d.accepted
                    ? 'transparent'
                    : 'rgba(234,179,8,0.05)',
                  opacity: d.rejected ? 0.5 : 1,
                }}
              >
                {/* Confidence dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }}
                  title={`${confidenceLabel(d.confidence)} confidence (${(d.confidence * 100).toFixed(0)}%)`}
                />

                {/* Class name */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: 'var(--io-text-primary)',
                    fontWeight: d.correctedClass ? 600 : 400,
                    textDecoration: d.rejected ? 'line-through' : 'none',
                  }}
                >
                  {d.correctedClass ? `${d.correctedClass} (corrected)` : d.class_name}
                </span>

                {/* Confidence % */}
                <span style={{ fontSize: 11, color: 'var(--io-text-muted)', flexShrink: 0, fontFamily: 'var(--io-font-mono)' }}>
                  {(d.confidence * 100).toFixed(0)}%
                </span>

                {/* Accept button */}
                <button
                  onClick={() => handleAccept(d._idx)}
                  title="Accept detection"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 'var(--io-radius)',
                    border: `1px solid ${d.accepted && !d.rejected ? '#22c55e' : 'var(--io-border)'}`,
                    background: d.accepted && !d.rejected ? 'rgba(34,197,94,0.15)' : 'transparent',
                    color: d.accepted && !d.rejected ? '#22c55e' : 'var(--io-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 13,
                  }}
                >
                  ✓
                </button>

                {/* Reject button */}
                <button
                  onClick={() => handleReject(d._idx)}
                  title="Reject detection"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 'var(--io-radius)',
                    border: `1px solid ${d.rejected ? '#ef4444' : 'var(--io-border)'}`,
                    background: d.rejected ? 'rgba(239,68,68,0.15)' : 'transparent',
                    color: d.rejected ? '#ef4444' : 'var(--io-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 13,
                  }}
                >
                  ✕
                </button>

                {/* Correct button */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setOpenCorrectionIdx(isOpen ? null : d._idx)}
                    title="Correct class"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 'var(--io-radius)',
                      border: `1px solid ${isOpen ? 'var(--io-accent)' : 'var(--io-border)'}`,
                      background: isOpen ? 'rgba(99,102,241,0.1)' : 'transparent',
                      color: isOpen ? 'var(--io-accent)' : 'var(--io-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                    }}
                  >
                    ✎
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 28,
                        zIndex: 10,
                        background: 'var(--io-surface-elevated)',
                        border: '1px solid var(--io-border)',
                        borderRadius: 'var(--io-radius)',
                        minWidth: 200,
                        maxHeight: 220,
                        overflowY: 'auto',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}
                    >
                      {classes.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--io-text-muted)' }}>
                          Loading classes...
                        </div>
                      )}
                      {classes.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => handleCorrect(d._idx, cls.name)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '7px 12px',
                            background: 'none',
                            border: 'none',
                            borderBottom: '1px solid var(--io-border)',
                            color: 'var(--io-text-secondary)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--io-surface)'
                            e.currentTarget.style.color = 'var(--io-text-primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none'
                            e.currentTarget.style.color = 'var(--io-text-secondary)'
                          }}
                        >
                          {cls.display_name || cls.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--io-text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            High (&gt;90%)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
            Medium (70–90%)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            Low (&lt;70%)
          </span>
        </div>
      </div>
    </WizardShell>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Generate
// ---------------------------------------------------------------------------

interface GenerateStepProps {
  detections: ReviewDetection[]
  domain: Domain
  imageUrl: string
  onBack: () => void
  onClose: () => void
}

function GenerateStep({ detections, domain, imageUrl, onBack, onClose }: GenerateStepProps) {
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accepted = detections.filter((d) => d.accepted && !d.rejected)
  const corrected = detections.filter((d) => !d.rejected && d.correctedClass)
  const rejected = detections.filter((d) => d.rejected)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    // Build payload for generate — use a hash of the imageUrl blob URL as source identifier
    const sourceHash = btoa(imageUrl).slice(0, 32)
    const generateResult = await recognitionApi.generateGraphic({
      detections: accepted.map(({ _idx: _i, accepted: _a, rejected: _r, correctedClass: _c, ...d }) => d),
      domain,
      source_image_hash: sourceHash,
    })

    if (!generateResult.success) {
      setGenerating(false)
      setError(generateResult.error.message)
      return
    }

    // Submit corrections feedback (fire-and-forget — do not block navigation on failure)
    if (corrected.length > 0 || rejected.length > 0) {
      const feedbackItems = [
        ...corrected.map((d) => ({
          original_class: d.class_name,
          corrected_class: d.correctedClass ?? d.class_name,
          confidence: d.confidence,
          domain,
          correction_type: 'wrong_class',
        })),
        ...rejected.map((d) => ({
          original_class: d.class_name,
          corrected_class: null,
          confidence: d.confidence,
          domain,
          correction_type: 'false_positive',
        })),
      ]
      recognitionApi.submitCorrections({ corrections: feedbackItems }).catch(() => {
        // non-critical
      })
    }

    setGenerating(false)

    // Navigate to the new graphic in Designer
    const graphicId = generateResult.data.graphic_id
    navigate(`/designer/graphics/${graphicId}/edit`)
    onClose()
  }

  return (
    <WizardShell
      step="generate"
      onClose={onClose}
      onBack={onBack}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--io-text-secondary)' }}>
          Review the summary below. Clicking "Generate Graphic" will create a new process graphic
          in the Designer with all accepted symbols placed at their detected positions.
        </p>

        {/* Summary */}
        <div
          style={{
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>
              {accepted.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>Accepted</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#eab308' }}>
              {corrected.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>Corrected</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>
              {rejected.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>Rejected</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--io-text-secondary)' }}>
          <span>Domain:</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--io-radius)',
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {domain === 'pid' ? 'P&ID' : 'DCS'}
          </span>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: '#ef4444',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            alignSelf: 'flex-start',
            height: 36,
            padding: '0 20px',
            background: generating ? 'var(--io-surface-elevated)' : 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: generating ? 'var(--io-text-muted)' : '#09090b',
            fontSize: 14,
            fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating && <SpinnerIcon />}
          {generating ? 'Generating...' : 'Generate Graphic'}
        </button>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--io-text-muted)' }}>
          After generation, the graphic will open in the Designer for manual refinement.
          {corrected.length + rejected.length > 0
            ? ' Corrections and rejections will be submitted as feedback to improve the model.'
            : ''}
        </p>
      </div>
    </WizardShell>
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: 'io-spin 0.8s linear infinite', display: 'inline-block' }}
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="10"
        opacity="0.8"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// RecognitionWizard — main exported component
// ---------------------------------------------------------------------------

export default function RecognitionWizard({ onClose }: RecognitionWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [detections, setDetections] = useState<ReviewDetection[]>([])
  const [domain, setDomain] = useState<Domain>('pid')

  // Revoke the object URL on unmount to free memory
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  function handleDetected(url: string, dets: ReviewDetection[], detectedDomain: Domain) {
    setImageUrl(url)
    setDetections(dets)
    setDomain(detectedDomain)
    setStep('review')
  }

  if (step === 'upload') {
    return <UploadStep onDetected={handleDetected} onClose={onClose} />
  }

  if (step === 'review') {
    return (
      <ReviewStep
        imageUrl={imageUrl}
        detections={detections}
        domain={domain}
        onDetectionsChange={setDetections}
        onDomainChange={setDomain}
        onBack={() => setStep('upload')}
        onNext={() => setStep('generate')}
        onClose={onClose}
      />
    )
  }

  return (
    <GenerateStep
      detections={detections}
      domain={domain}
      imageUrl={imageUrl}
      onBack={() => setStep('review')}
      onClose={onClose}
    />
  )
}

// ---------------------------------------------------------------------------
// RecognitionWizardTrigger — entry point with permission + availability check
// ---------------------------------------------------------------------------

/**
 * Renders a "Recognize Image" button that opens RecognitionWizard.
 * Performs an availability check against GET /api/recognition/status:
 * - If both domains are disabled → renders an unavailable notice
 * - If user lacks designer:import → renders nothing
 *
 * Props:
 *   canImport — boolean from useDesignerPermissions().canImport
 *   renderAs  — 'button' (default) renders a styled quick-action button
 *               'inline' renders only the button text variant for integration
 */
export interface RecognitionWizardTriggerProps {
  canImport: boolean
  renderAs?: 'button' | 'inline'
}

export function RecognitionWizardTrigger({ canImport, renderAs = 'button' }: RecognitionWizardTriggerProps) {
  const [status, setStatus] = useState<RecognitionStatus | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  // Check recognition service availability on mount
  useEffect(() => {
    if (!canImport) return
    recognitionApi.getStatus().then((res) => {
      if (res.success) setStatus(res.data)
      setStatusLoaded(true)
    }).catch(() => {
      setStatusLoaded(true)
    })
  }, [canImport])

  // Do not render anything if user lacks permission
  if (!canImport) return null

  // Wait for status check before rendering trigger
  if (!statusLoaded) return null

  // Check if recognition is unavailable (both domains disabled)
  const bothDisabled =
    status !== null &&
    status.domains.pid.mode === 'disabled' &&
    status.domains.dcs.mode === 'disabled'

  if (bothDisabled) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 14px',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-text-muted)',
          fontSize: '13px',
        }}
        title="Symbol recognition is not available. No model is loaded. Contact your administrator."
      >
        <span>⊘</span>
        Recognition not available
      </div>
    )
  }

  if (renderAs === 'inline') {
    return (
      <>
        <button
          onClick={() => setWizardOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-accent)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
          }}
        >
          Recognize Image
        </button>
        {wizardOpen && <RecognitionWizard onClose={() => setWizardOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setWizardOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 14px',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-text-secondary)',
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'border-color 0.1s, color 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--io-accent)'
          e.currentTarget.style.color = 'var(--io-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--io-border)'
          e.currentTarget.style.color = 'var(--io-text-secondary)'
        }}
      >
        <span>⬡</span>
        Recognize Image
      </button>
      {wizardOpen && <RecognitionWizard onClose={() => setWizardOpen(false)} />}
    </>
  )
}
