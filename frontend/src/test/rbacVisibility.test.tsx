/**
 * RBAC UI visibility tests — doc 33 §Integration Tests
 *
 * Verifies that UI elements show/hide correctly based on permission sets.
 * Tests the PermissionGuard component and permission-based rendering helpers
 * using a Zustand auth store mock pattern (setState without router deps).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PermissionGuard, { ForbiddenPage, LoadingSpinner } from '../shared/components/PermissionGuard'
import { useAuthStore } from '../store/auth'

// ---------------------------------------------------------------------------
// Helpers — build a minimal AuthUser directly via Zustand setState
// ---------------------------------------------------------------------------

function makeUser(permissions: string[]) {
  return {
    id: 'test-user',
    username: 'tester',
    email: 'test@io.test',
    full_name: 'Test User',
    permissions,
  }
}

function setAuthState({
  user = null as ReturnType<typeof makeUser> | null,
  isAuthenticated = false,
  isLoading = false,
} = {}) {
  act(() => {
    useAuthStore.setState({ user, isAuthenticated, isLoading })
  })
}

beforeEach(() => {
  // Reset to unauthenticated state before each test
  setAuthState({ user: null, isAuthenticated: false, isLoading: false })
})

// ---------------------------------------------------------------------------
// PermissionGuard — unauthenticated
// ---------------------------------------------------------------------------

describe('PermissionGuard — unauthenticated', () => {
  it('redirects to /login when not authenticated', () => {
    setAuthState({ user: null, isAuthenticated: false })
    render(
      <MemoryRouter initialEntries={['/console']}>
        <PermissionGuard permission="console:read">
          <div>Console Content</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    // Children are NOT rendered — redirect happens
    expect(screen.queryByText('Console Content')).toBeNull()
  })

  it('shows loading spinner while isLoading is true', () => {
    setAuthState({ user: null, isAuthenticated: false, isLoading: true })
    const { container } = render(
      <MemoryRouter>
        <PermissionGuard permission="console:read">
          <div>Protected Content</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    // LoadingSpinner renders a div with animation styles, children absent
    expect(screen.queryByText('Protected Content')).toBeNull()
    // The spinner div should be in the DOM
    expect(container.querySelector('[style*="border"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PermissionGuard — authenticated, various permission scenarios
// ---------------------------------------------------------------------------

describe('PermissionGuard — permission checks', () => {
  it('renders children when user has the required permission', () => {
    setAuthState({ user: makeUser(['console:read', 'process:read']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="console:read">
          <div>Console Content</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.getByText('Console Content')).toBeDefined()
  })

  it('shows ForbiddenPage when user lacks the required permission', () => {
    setAuthState({ user: makeUser(['process:read']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="console:write">
          <div>Write Actions</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Write Actions')).toBeNull()
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  it('renders children when permission is null (no restriction)', () => {
    setAuthState({ user: makeUser([]), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission={null}>
          <div>Open Content</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.getByText('Open Content')).toBeDefined()
  })

  it('renders children for user with exact matching permission', () => {
    const perms = ['reports:generate', 'reports:view']
    setAuthState({ user: makeUser(perms), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="reports:generate">
          <div>Generate Report</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.getByText('Generate Report')).toBeDefined()
  })

  it('blocks user with adjacent but not exact permission', () => {
    // Has reports:read but NOT reports:generate
    setAuthState({ user: makeUser(['reports:read']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="reports:generate">
          <div>Generate Button</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Generate Button')).toBeNull()
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  // Regression: DD-27-010 — /settings/sms-providers returned Access Denied for admin user.
  // The route requires system:configure which was missing from the seed permissions table.
  // Migration 20260323000001 adds system:configure and assigns it to the Admin role.
  it('admin with system:configure can access SMS providers page guard', () => {
    setAuthState({ user: makeUser(['system:configure']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="system:configure">
          <div>SMS Providers</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.getByText('SMS Providers')).toBeDefined()
    expect(screen.queryByText('Access Denied')).toBeNull()
  })

  it('user without system:configure sees Access Denied on SMS providers page guard', () => {
    setAuthState({ user: makeUser(['settings:read', 'auth:manage_mfa']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="system:configure">
          <div>SMS Providers</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.queryByText('SMS Providers')).toBeNull()
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  it('admin permission does not bypass specific module permission check', () => {
    // console:admin does NOT grant console:workspace_publish unless explicitly listed
    setAuthState({ user: makeUser(['console:admin']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="console:workspace_publish">
          <div>Publish</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    // PermissionGuard does exact string match — console:admin ≠ console:workspace_publish
    expect(screen.queryByText('Publish')).toBeNull()
  })

  it('user with all console permissions can access each guarded section', () => {
    const consolePerms = [
      'console:read',
      'console:write',
      'console:workspace_write',
      'console:workspace_publish',
      'console:workspace_delete',
      'console:export',
      'console:admin',
    ]
    setAuthState({ user: makeUser(consolePerms), isAuthenticated: true })

    for (const perm of consolePerms) {
      const { unmount } = render(
        <MemoryRouter>
          <PermissionGuard permission={perm}>
            <div data-testid={`perm-${perm}`}>{perm}</div>
          </PermissionGuard>
        </MemoryRouter>,
      )
      expect(screen.getByText(perm)).toBeDefined()
      unmount()
    }
  })
})

// ---------------------------------------------------------------------------
// ForbiddenPage — standalone rendering
// ---------------------------------------------------------------------------

describe('ForbiddenPage', () => {
  it('renders Access Denied heading', () => {
    render(<ForbiddenPage />)
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  it('renders permission explanation text', () => {
    render(<ForbiddenPage />)
    expect(screen.getByText(/You do not have permission/)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// LoadingSpinner — standalone rendering
// ---------------------------------------------------------------------------

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.firstChild).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Permission-based conditional rendering (simulating inline UI guards)
// ---------------------------------------------------------------------------

// Helper simulating the pattern used in console/index.tsx:
// `user?.permissions.includes('console:workspace_publish') ?? false`
function canDo(permissions: string[], perm: string): boolean {
  return permissions.includes(perm)
}

describe('inline permission checks (UI element gating)', () => {
  it('canDo returns true when permission is present', () => {
    expect(canDo(['console:read', 'console:write'], 'console:write')).toBe(true)
  })

  it('canDo returns false when permission is absent', () => {
    expect(canDo(['console:read'], 'console:write')).toBe(false)
  })

  it('canDo returns false for empty permission list', () => {
    expect(canDo([], 'console:read')).toBe(false)
  })

  it('canDo is case-sensitive — uppercase does not match', () => {
    expect(canDo(['Console:Read'], 'console:read')).toBe(false)
  })

  it('publish button visible only to users with console:workspace_publish', () => {
    const publisher = makeUser(['console:read', 'console:workspace_publish'])
    const viewer = makeUser(['console:read'])

    expect(canDo(publisher.permissions, 'console:workspace_publish')).toBe(true)
    expect(canDo(viewer.permissions, 'console:workspace_publish')).toBe(false)
  })

  it('delete workspace visible only to users with console:workspace_delete', () => {
    const admin = makeUser(['console:read', 'console:workspace_delete'])
    const editor = makeUser(['console:read', 'console:workspace_write'])

    expect(canDo(admin.permissions, 'console:workspace_delete')).toBe(true)
    expect(canDo(editor.permissions, 'console:workspace_delete')).toBe(false)
  })

  it('rounds:write and rounds:approve are independent permissions', () => {
    const performer = makeUser(['rounds:write'])
    const approver = makeUser(['rounds:approve'])
    const both = makeUser(['rounds:write', 'rounds:approve'])

    expect(canDo(performer.permissions, 'rounds:write')).toBe(true)
    expect(canDo(performer.permissions, 'rounds:approve')).toBe(false)
    expect(canDo(approver.permissions, 'rounds:approve')).toBe(true)
    expect(canDo(approver.permissions, 'rounds:write')).toBe(false)
    expect(canDo(both.permissions, 'rounds:write')).toBe(true)
    expect(canDo(both.permissions, 'rounds:approve')).toBe(true)
  })

  it('settings:admin permission gates admin-only actions', () => {
    const sysAdmin = makeUser(['settings:read', 'settings:write', 'settings:admin'])
    const regular = makeUser(['settings:read'])

    expect(canDo(sysAdmin.permissions, 'settings:admin')).toBe(true)
    expect(canDo(regular.permissions, 'settings:admin')).toBe(false)
  })

  // Regression: DD-27-010 — SMS providers page returned Access Denied for admin.
  // Root cause: system:configure was missing from the permissions table seed.
  // Fix: migration 20260323000001 adds system:configure and assigns it to the Admin role.
  it('system:configure grants access to SMS providers settings page', () => {
    const adminUser = makeUser(['system:configure', 'system:manage_users', 'system:manage_roles'])
    const viewerUser = makeUser(['settings:read'])

    expect(canDo(adminUser.permissions, 'system:configure')).toBe(true)
    expect(canDo(viewerUser.permissions, 'system:configure')).toBe(false)
  })

  // Regression: DD-15-014 — /settings/eula returned Access Denied for admin user.
  // Root cause: system:configure was missing from the permissions table seed.
  // The EULA route (App.tsx) uses PermissionGuard permission="system:configure".
  // Fix: migration 20260324000002 ensures system:configure exists in permissions
  // table and is assigned to the Admin role on all installation paths.
  it('admin with system:configure can access EULA settings page guard', () => {
    setAuthState({ user: makeUser(['system:configure', 'system:manage_users']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="system:configure">
          <div>EULA Settings</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.getByText('EULA Settings')).toBeDefined()
    expect(screen.queryByText('Access Denied')).toBeNull()
  })

  it('user without system:configure sees Access Denied on EULA settings page guard', () => {
    setAuthState({ user: makeUser(['settings:read', 'system:manage_users']), isAuthenticated: true })
    render(
      <MemoryRouter>
        <PermissionGuard permission="system:configure">
          <div>EULA Settings</div>
        </PermissionGuard>
      </MemoryRouter>,
    )
    expect(screen.queryByText('EULA Settings')).toBeNull()
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  it('system:configure grants access to EULA admin settings', () => {
    const adminUser = makeUser([
      'system:configure', 'system:manage_users', 'system:manage_roles', 'system:admin',
    ])
    const operatorUser = makeUser(['console:read', 'process:read'])

    expect(canDo(adminUser.permissions, 'system:configure')).toBe(true)
    expect(canDo(operatorUser.permissions, 'system:configure')).toBe(false)
  })
})
