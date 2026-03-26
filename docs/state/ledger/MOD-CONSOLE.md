MOD-CONSOLE-001 | Implement WorkspaceStore, SelectionStore, and RealtimeStore as separate Zustand stores | verified 2026-03-21 | commit a320c57 | npx tsc --noEmit | PASS (SUPERSEDED — was wrong task)
MOD-CONSOLE-003 | Replace per-tab WsManager singleton with SharedWorker for WebSocket connection | verified 2026-03-21 | commit a320c57 | npx tsc --noEmit | PASS (SUPERSEDED — was wrong task)
MOD-CONSOLE-006 | Replace local point context menu in GraphicPane with shared PointContextMenu component | verified 2026-03-21 | commit a320c57 | npx tsc --noEmit | PASS (SUPERSEDED — may have been incomplete)
MOD-CONSOLE-001 | Implement auto-save failure persistent banner with exponential backoff retry | verified 2026-03-22 | commit a320c57 | npx tsc --noEmit | PASS
MOD-CONSOLE-006 | Replace local point context menu in GraphicPane with shared PointContextMenu component | verified 2026-03-22 | commit a320c57 | npx tsc --noEmit | PASS
MOD-CONSOLE-003 | SharedWorker WebSocket bridge | verified 2026-03-22 | commit a320c57 | npx tsc --noEmit | PASS
MOD-CONSOLE-002 | Preserve pane content in overflow stack when template downsizes | verified 2026-03-22 | commit a320c57 | npx tsc --noEmit | PASS
MOD-CONSOLE-004 | Add favorites group, view-mode selector, and per-section search to left nav panel; make panel resizable | verified 2026-03-22 | commit a320c57 | npx tsc --noEmit | PASS
MOD-CONSOLE-005 | Implement all 6 export formats and async export path for Console workspace data | verified 2026-03-22 | commit a320c57 | npx tsc --noEmit | PASS
MOD-CONSOLE-001 | Add favorites group, view-mode selector, and section-height resize to left nav panel | verified 2026-03-22 | commit 4dc822f | npx tsc --noEmit | PASS
MOD-CONSOLE-002 | Implement detached window support for Console panes | verified 2026-03-22 | commit 4dc822f | npx tsc --noEmit | PASS
MOD-CONSOLE-003 | Persist aspect ratio lock per-workspace in WorkspaceConfig.settings | verified 2026-03-22 | commit 4dc822f | npx tsc --noEmit | PASS
MOD-CONSOLE-004 | Fix Historical Playback Bar speed values, add alarm markers, and keyboard shortcuts | verified 2026-03-22 | commit 4dc822f | npx tsc --noEmit | PASS
MOD-CONSOLE-005 | Add nested error boundaries around individual panes to isolate crashes | verified 2026-03-22 | commit 4dc822f | npx tsc --noEmit | PASS
MOD-CONSOLE-006 | Gate Create Workspace empty-state CTA on console:write permission | verified 2026-03-22 | commit 4dc822f | npx tsc --noEmit | PASS
MOD-CONSOLE-012 | Add nested error boundaries around individual panes | verified 2026-03-22 | commit 908fb71 | npx tsc --noEmit | PASS
MOD-CONSOLE-007 | Make PointDetailPanel resizable, pinnable, minimizable, and session-position-persisted | verified 2026-03-22 | commit 2f102cd | cd frontend && npx tsc --noEmit | PASS
MOD-CONSOLE-008 | Fix playback bar speed options, add loop region, reverse transport, step interval dropdown, and keyboard shortcuts | verified 2026-03-22 | commit 6d6e6f6 | npx tsc --noEmit | PASS
MOD-CONSOLE-009 | Fix ErrorBoundary button label to "[Reload Module]" and add nested per-pane boundaries | verified 2026-03-22 | commit 4d1a619 | cd /home/io/io-dev/io/frontend && npx tsc --noEmit | PASS
MOD-CONSOLE-013 | Replace hardcoded hex colors in Console with design token CSS variables | verified 2026-03-23 | commit 4af80f3 | npx tsc --noEmit | PASS
MOD-CONSOLE-010 | Replace text loading state with Console-shaped skeleton | verified 2026-03-23 | commit 3e74cb4 | cd frontend && npx tsc --noEmit | PASS
MOD-CONSOLE-011 | Fix kiosk URL parameter from ?mode=kiosk to ?kiosk=true; add corner dwell exit trigger | verified 2026-03-23 | commit a685822 | npx tsc --noEmit | PASS
MOD-CONSOLE-014 | Fix dynamic import error — incorrect SharedWorker path in useWsWorker.ts | verified 2026-03-23 | commit f1d002c | npx tsc --noEmit | PASS
MOD-CONSOLE-015 | fix TypeError reading 'reduce' on workspaces selector | verified 2026-03-23 | commit c0a215f | npx tsc --noEmit | PASS
MOD-CONSOLE-016 | Favorites group missing from console left nav panel | verified 2026-03-24 | commit b57fece | npx tsc --noEmit | PASS
MOD-CONSOLE-017 | Console kiosk mode URL parameter fix | verified 2026-03-24 | commit f6431d9 | npx tsc --noEmit | PASS
MOD-CONSOLE-018 | Pane context menu missing "Open in New Window" item for detached window | verified 2026-03-24 | commit 312ef5e | npx tsc --noEmit | PASS
MOD-CONSOLE-019 | No right-click context menu on workspace rows in left nav | verified 2026-03-24 | commit 5630d49 | npx tsc --noEmit | PASS
MOD-CONSOLE-020 | Kiosk mode does not hide Console ASSETS/left panel | verified 2026-03-24 | commit e674eff | npx tsc --noEmit | PASS
MOD-CONSOLE-021 | Workspace list items missing right-click context menu | verified 2026-03-24 | commit 88620cf | npx tsc --noEmit | PASS
MOD-CONSOLE-024 | Search/filter input missing from left nav section panels | verified 2026-03-25 | commit de30ad3 | npx tsc --noEmit | PASS
MOD-CONSOLE-022 | Favorites group missing from Workspaces section in left nav | verified 2026-03-25 | commit dec549d | npx tsc --noEmit | PASS
MOD-CONSOLE-025 | Detached console route /detached/console/:id is a Phase 7 stub | verified 2026-03-25 | commit 80a3953 | npx tsc --noEmit | PASS
MOD-CONSOLE-024 | Search/filter input missing from left nav section panels | verified 2026-03-25 | commit c309546 | npx tsc --noEmit | PASS
MOD-CONSOLE-024 | Search/filter input missing from left nav section panels | verified 2026-03-25 | commit c312a44 | npx tsc --noEmit | PASS
MOD-CONSOLE-023 | View-mode selector buttons missing from left nav section headers | verified 2026-03-25 | commit fd25ac0 | npx tsc --noEmit | PASS
MOD-CONSOLE-022 | Favorites group missing from Workspaces section in left nav | verified 2026-03-26 | commit f5b7104 | npx tsc --noEmit | PASS
MOD-CONSOLE-026 | Kiosk mode corner dwell exit trigger not implemented | verified 2026-03-26 | commit f717ebf | npx tsc --noEmit | PASS
MOD-CONSOLE-022 | Favorites group missing from Workspaces section in left nav | verified 2026-03-26 | commit 1e1136b | npx tsc --noEmit | PASS
MOD-CONSOLE-027 | Workspaces section Favorites group missing when no favorites are set | verified 2026-03-26 | commit 04e7ad7 | npx tsc --noEmit | PASS
MOD-CONSOLE-029 | Workspace save feedback missing dirty indicator and persistent failure banner | verified 2026-03-26 | commit d01a6d6 | npx tsc --noEmit | PASS
MOD-CONSOLE-031 | Detached console route /detached/console/:id still renders Phase 7 stub | verified 2026-03-26 | commit f9591d7 | npx tsc --noEmit | PASS
MOD-CONSOLE-032 | Workspace tab dirty indicator missing after layout change in edit mode | verified 2026-03-26 | commit 41c9d7e | npx tsc --noEmit | PASS
MOD-CONSOLE-033 | Bug: shape library shapes appear in Console and Process graphics pickers | verified 2026-03-26 | commit a03f64c | npx tsc --noEmit | PASS
MOD-CONSOLE-034 | Bug: workspace right-click context menu missing Rename/Duplicate/Delete in thumbnail and grid views | verified 2026-03-26 | commit 5968fc0 | npx tsc --noEmit | PASS
MOD-CONSOLE-035 | Remove guard blocking deletion of the last workspace | verified 2026-03-26 | commit 1c85150 | npx tsc --noEmit | PASS
MOD-CONSOLE-037 | Drag in workspace edit mode displaces and hides non-dragged panes | verified 2026-03-26 | commit e0dbe0f | npx tsc --noEmit | PASS
