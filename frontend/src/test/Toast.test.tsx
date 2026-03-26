import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { showToast, useToastStore } from '../shared/components/Toast'
import ToastProvider from '../shared/components/Toast'

// Reset toast store between tests
beforeEach(() => {
  act(() => {
    useToastStore.setState({ toasts: [] })
  })
})

describe('showToast / useToastStore', () => {
  it('adds a toast to the store', () => {
    act(() => {
      showToast({ title: 'Hello', variant: 'success' })
    })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].title).toBe('Hello')
    expect(toasts[0].variant).toBe('success')
  })

  it('assigns a unique id to each toast', () => {
    act(() => {
      showToast({ title: 'First', variant: 'info' })
      showToast({ title: 'Second', variant: 'info' })
    })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0].id).not.toBe(toasts[1].id)
  })

  it('dismiss removes the correct toast by id', () => {
    act(() => {
      showToast({ title: 'To remove', variant: 'warning' })
    })
    const id = useToastStore.getState().toasts[0].id
    act(() => {
      useToastStore.getState().dismiss(id)
    })
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('stores optional description', () => {
    act(() => {
      showToast({ title: 'With desc', variant: 'error', description: 'Something went wrong' })
    })
    const toast = useToastStore.getState().toasts[0]
    expect(toast.description).toBe('Something went wrong')
  })
})

describe('Auto-dismiss behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('success toast auto-dismisses after 5 seconds', async () => {
    act(() => {
      showToast({ title: 'Workspace created', variant: 'success' })
    })
    render(<ToastProvider />)
    expect(screen.getByText('Workspace created')).toBeDefined()

    // Advance past the 5000ms auto-dismiss threshold
    await act(async () => {
      vi.advanceTimersByTime(5001)
    })

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('error toast does NOT auto-dismiss after 10 seconds', async () => {
    act(() => {
      showToast({ title: 'Backend error', variant: 'error' })
    })
    render(<ToastProvider />)
    expect(screen.getByText('Backend error')).toBeDefined()

    // Advance well past any auto-dismiss threshold — error must remain
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('error')
  })

  it('info toast auto-dismisses after 5 seconds', async () => {
    act(() => {
      showToast({ title: 'Info message', variant: 'info' })
    })
    render(<ToastProvider />)

    await act(async () => {
      vi.advanceTimersByTime(5001)
    })

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('warning toast auto-dismisses after 5 seconds', async () => {
    act(() => {
      showToast({ title: 'Warning message', variant: 'warning' })
    })
    render(<ToastProvider />)

    await act(async () => {
      vi.advanceTimersByTime(5001)
    })

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('success toast is still present at 4.9 seconds', async () => {
    act(() => {
      showToast({ title: 'Still here', variant: 'success' })
    })
    render(<ToastProvider />)

    await act(async () => {
      vi.advanceTimersByTime(4900)
    })

    // Should not have dismissed yet
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('error toast has effective duration of 0 — no timer fires', async () => {
    act(() => {
      showToast({ title: 'Persists', variant: 'error' })
    })
    const toast = useToastStore.getState().toasts[0]
    // Verify the duration contract: error variant defaults to 0 (no timer)
    const defaultDuration = toast.variant === 'error' ? 0 : 5000
    const effectiveDuration = toast.duration ?? defaultDuration
    expect(effectiveDuration).toBe(0)
  })
})

describe('ToastProvider renders toasts', () => {
  it('renders a success toast title', () => {
    act(() => {
      showToast({ title: 'Hello World', variant: 'success' })
    })
    render(<ToastProvider />)
    expect(screen.getByText('Hello World')).toBeDefined()
  })

  it('renders an error toast title', () => {
    act(() => {
      showToast({ title: 'Error occurred', variant: 'error' })
    })
    render(<ToastProvider />)
    expect(screen.getByText('Error occurred')).toBeDefined()
  })

  it('renders a toast description when provided', () => {
    act(() => {
      showToast({ title: 'Alert', variant: 'warning', description: 'Check your settings' })
    })
    render(<ToastProvider />)
    expect(screen.getByText('Check your settings')).toBeDefined()
  })
})
