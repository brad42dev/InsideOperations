import { describe, it, expect, beforeEach } from 'vitest'
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
