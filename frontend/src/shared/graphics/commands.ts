import type {
  SceneNode,
  GraphicDocument,
  NodeId,
  Transform,
  PointBinding,
  PrimitiveStyle,
  LayerDefinition,
  Point2D,
  DisplayElement,
  DisplayElementConfig,
  ComposablePart,
  NavigationLink,
  GraphicExpression,
} from '../types/graphics'

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

export interface SceneCommand {
  /** Human-readable description for undo/redo UI */
  description: string
  /** Apply this command to the scene graph. Returns the new document. */
  execute(doc: GraphicDocument): GraphicDocument
  /** Undo this command. Returns the previous document. */
  undo(doc: GraphicDocument): GraphicDocument
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Deep clone using JSON serialization (scene graph is JSON-safe) */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/** Find a node by ID anywhere in the tree. Returns [node, parent, index] or null. */
function findNode(
  doc: GraphicDocument,
  id: NodeId
): { node: SceneNode; parent: SceneNode & { children: SceneNode[] }; index: number } | null {
  function search(
    node: SceneNode,
    _parent: (SceneNode & { children: SceneNode[] }) | null
  ): { node: SceneNode; parent: SceneNode & { children: SceneNode[] }; index: number } | null {
    if ('children' in node && Array.isArray(node.children)) {
      const children = node.children as SceneNode[]
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.id === id) {
          return { node: child, parent: node as SceneNode & { children: SceneNode[] }, index: i }
        }
        const found = search(child, node as SceneNode & { children: SceneNode[] })
        if (found) return found
      }
    }
    return null
  }
  return search(doc as unknown as SceneNode, null)
}

/** Update a node in-place (immutably) */
function updateNode(doc: GraphicDocument, id: NodeId, updater: (node: SceneNode) => unknown): GraphicDocument {
  const newDoc = clone(doc)
  const result = findNode(newDoc, id)
  if (!result) return newDoc
  const { parent, index } = result
  parent.children[index] = updater(parent.children[index]) as SceneNode
  return newDoc
}

// ---------------------------------------------------------------------------
// Individual Commands
// ---------------------------------------------------------------------------

export class MoveNodesCommand implements SceneCommand {
  description = 'Move'
  constructor(
    private nodeIds: NodeId[],
    private delta: { x: number; y: number },
    private previousTransforms: Map<NodeId, Transform>
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      d = updateNode(d, id, (node) => ({
        ...node,
        transform: {
          ...node.transform,
          position: {
            x: node.transform.position.x + this.delta.x,
            y: node.transform.position.y + this.delta.y,
          },
        },
      }))
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      const prev = this.previousTransforms.get(id)
      if (!prev) continue
      d = updateNode(d, id, (node) => ({ ...node, transform: clone(prev) }))
    }
    return d
  }
}

export class ResizeNodeCommand implements SceneCommand {
  description = 'Resize'
  constructor(
    private nodeId: NodeId,
    private newTransform: Transform,
    private prevTransform: Transform
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      transform: clone(this.newTransform),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      transform: clone(this.prevTransform),
    }))
  }
}

export class AddNodeCommand implements SceneCommand {
  description = 'Add'
  constructor(
    private node: SceneNode,
    private parentId: NodeId | null // null = root document
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    if (!this.parentId) {
      d.children = [...d.children, clone(this.node)]
      return d
    }
    return updateNode(d, this.parentId, (parent) => {
      if (!('children' in parent)) return parent
      return {
        ...parent,
        children: [...(parent as SceneNode & { children: SceneNode[] }).children, clone(this.node)],
      }
    })
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const nodeId = this.node.id
    if (!this.parentId) {
      d.children = d.children.filter((n) => n.id !== nodeId)
      return d
    }
    return updateNode(d, this.parentId, (parent) => {
      if (!('children' in parent)) return parent
      return {
        ...parent,
        children: (parent as SceneNode & { children: SceneNode[] }).children.filter(
          (n) => n.id !== nodeId
        ),
      }
    })
  }
}

export class DeleteNodesCommand implements SceneCommand {
  description = 'Delete'
  private snapshots: Array<{ node: SceneNode; parentId: NodeId | null; index: number }> = []

  constructor(private nodeIds: NodeId[]) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    this.snapshots = []

    for (const id of this.nodeIds) {
      const result = findNode(d, id)
      if (!result) continue
      // parentId is null when the parent is the document root
      const parentId = result.parent.id === d.id ? null : (result.parent.id ?? null)
      this.snapshots.push({
        node: clone(result.node),
        parentId,
        index: result.index,
      })
      result.parent.children.splice(result.index, 1)
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    // Restore in reverse order to preserve indices
    for (const snap of [...this.snapshots].reverse()) {
      if (!snap.parentId) {
        d.children.splice(snap.index, 0, clone(snap.node))
      } else {
        d = updateNode(d, snap.parentId, (parent) => {
          if (!('children' in parent)) return parent
          const children = [...(parent as SceneNode & { children: SceneNode[] }).children]
          children.splice(snap.index, 0, clone(snap.node))
          return { ...parent, children }
        })
      }
    }
    return d
  }
}

export class ChangePropertyCommand implements SceneCommand {
  description = 'Change Property'
  constructor(
    private nodeId: NodeId,
    private property: string,
    private newValue: unknown,
    private prevValue: unknown
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      [this.property]: clone(this.newValue),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      [this.property]: clone(this.prevValue),
    }))
  }
}

export class ChangeBindingCommand implements SceneCommand {
  description = 'Change Binding'
  constructor(
    private nodeId: NodeId,
    private newBinding: PointBinding,
    private prevBinding: PointBinding
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      binding: clone(this.newBinding),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      binding: clone(this.prevBinding),
    }))
  }
}

export class ChangeStyleCommand implements SceneCommand {
  description = 'Change Style'
  constructor(
    private nodeId: NodeId,
    private newStyle: PrimitiveStyle,
    private prevStyle: PrimitiveStyle
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      style: clone(this.newStyle),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      style: clone(this.prevStyle),
    }))
  }
}

export class ReorderNodeCommand implements SceneCommand {
  description = 'Reorder'
  constructor(
    private newIndex: number,
    private prevIndex: number,
    private parentId: NodeId | null
  ) {}

  private reorder(doc: GraphicDocument, fromIdx: number, toIdx: number): GraphicDocument {
    const d = clone(doc)
    if (!this.parentId) {
      const [item] = d.children.splice(fromIdx, 1)
      d.children.splice(toIdx, 0, item)
      return d
    }
    return updateNode(d, this.parentId, (parent) => {
      if (!('children' in parent)) return parent
      const children = [...(parent as SceneNode & { children: SceneNode[] }).children]
      const [item] = children.splice(fromIdx, 1)
      children.splice(toIdx, 0, item)
      return { ...parent, children }
    })
  }

  execute(doc: GraphicDocument): GraphicDocument {
    return this.reorder(doc, this.prevIndex, this.newIndex)
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return this.reorder(doc, this.newIndex, this.prevIndex)
  }
}

export class GroupNodesCommand implements SceneCommand {
  description = 'Group'
  private group!: SceneNode & { children: SceneNode[] }
  private removedNodes: Array<{ node: SceneNode; index: number }> = []

  constructor(private nodeIds: NodeId[]) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    this.removedNodes = []

    const nodes: SceneNode[] = []
    for (const id of this.nodeIds) {
      const idx = d.children.findIndex((n) => n.id === id)
      if (idx >= 0) {
        this.removedNodes.push({ node: clone(d.children[idx]), index: idx })
        nodes.push(d.children[idx])
      }
    }

    // Remove from root (in reverse index order)
    for (const { index } of [...this.removedNodes].sort((a, b) => b.index - a.index)) {
      d.children.splice(index, 1)
    }

    const minIndex = Math.min(...this.removedNodes.map((r) => r.index))
    const groupId = crypto.randomUUID()
    this.group = {
      id: groupId,
      type: 'group',
      name: 'Group',
      transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
      visible: true,
      locked: false,
      opacity: 1,
      children: nodes,
    } as SceneNode & { children: SceneNode[] }

    d.children.splice(minIndex, 0, this.group)
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const groupIdx = d.children.findIndex((n) => n.id === this.group.id)
    if (groupIdx >= 0) d.children.splice(groupIdx, 1)

    for (const { node, index } of [...this.removedNodes].sort((a, b) => a.index - b.index)) {
      d.children.splice(index, 0, clone(node))
    }
    return d
  }
}

export class UngroupCommand implements SceneCommand {
  description = 'Ungroup'
  private savedGroup!: SceneNode & { children: SceneNode[] }
  private groupIndex = 0

  constructor(private groupId: NodeId) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const idx = d.children.findIndex((n) => n.id === this.groupId)
    if (idx < 0) return d

    this.savedGroup = clone(d.children[idx]) as SceneNode & { children: SceneNode[] }
    this.groupIndex = idx

    const children = (this.savedGroup as SceneNode & { children: SceneNode[] }).children ?? []
    d.children.splice(idx, 1, ...children)
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const childIds = new Set((this.savedGroup as SceneNode & { children: SceneNode[] }).children?.map((c) => c.id) ?? [])
    d.children = d.children.filter((n) => !childIds.has(n.id))
    d.children.splice(this.groupIndex, 0, clone(this.savedGroup))
    return d
  }
}

export class DuplicateNodesCommand implements SceneCommand {
  description = 'Duplicate'
  private newIds: NodeId[] = []

  constructor(private nodeIds: NodeId[]) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    this.newIds = []

    for (const id of this.nodeIds) {
      const idx = d.children.findIndex((n) => n.id === id)
      if (idx >= 0) {
        const duped = clone(d.children[idx])
        duped.id = crypto.randomUUID()
        duped.transform.position.x += 20
        duped.transform.position.y += 20
        this.newIds.push(duped.id)
        d.children.splice(idx + 1, 0, duped)
      }
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const ids = new Set(this.newIds)
    d.children = d.children.filter((n) => !ids.has(n.id))
    return d
  }
}

export class PasteNodesCommand implements SceneCommand {
  description = 'Paste'
  private pastedIds: NodeId[] = []

  constructor(private nodes: SceneNode[]) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    this.pastedIds = []
    for (const node of this.nodes) {
      const newNode = clone(node)
      newNode.id = crypto.randomUUID()
      this.pastedIds.push(newNode.id)
      d.children.push(newNode)
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const ids = new Set(this.pastedIds)
    d.children = d.children.filter((n) => !ids.has(n.id))
    return d
  }
}

export class SetVisibilityCommand implements SceneCommand {
  description = 'Set Visibility'
  constructor(
    private nodeId: NodeId,
    private visible: boolean,
    private prevVisible: boolean
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, visible: this.visible }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, visible: this.prevVisible }))
  }
}

export class SetLockCommand implements SceneCommand {
  description = 'Lock/Unlock'
  constructor(
    private nodeId: NodeId,
    private locked: boolean,
    private prevLocked: boolean
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, locked: this.locked }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, locked: this.prevLocked }))
  }
}

export class SetOpacityCommand implements SceneCommand {
  description = 'Set Opacity'
  constructor(
    private nodeId: NodeId,
    private opacity: number,
    private prevOpacity: number
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, opacity: this.opacity }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, opacity: this.prevOpacity }))
  }
}

export class SetLayerCommand implements SceneCommand {
  description = 'Move to Layer'
  constructor(
    private nodeId: NodeId,
    private layerId: string,
    private prevLayerId: string | undefined
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, layerId: this.layerId }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, layerId: this.prevLayerId }))
  }
}

export class AddLayerCommand implements SceneCommand {
  description = 'Add Layer'
  constructor(private layer: LayerDefinition) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    d.layers = [...d.layers, clone(this.layer)]
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    d.layers = d.layers.filter((l) => l.id !== this.layer.id)
    return d
  }
}

export class RemoveLayerCommand implements SceneCommand {
  description = 'Remove Layer'
  private prevLayer!: LayerDefinition
  private prevIndex = 0

  constructor(private layerId: string) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    const idx = d.layers.findIndex((l) => l.id === this.layerId)
    if (idx >= 0) {
      this.prevLayer = clone(d.layers[idx])
      this.prevIndex = idx
      d.layers.splice(idx, 1)
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    d.layers.splice(this.prevIndex, 0, clone(this.prevLayer))
    return d
  }
}

export class RenameNodeCommand implements SceneCommand {
  description = 'Rename'
  constructor(
    private nodeId: NodeId,
    private newName: string,
    private prevName: string | undefined
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, name: this.newName }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, name: this.prevName }))
  }
}

export class UpdatePathCommand implements SceneCommand {
  description = 'Update Path'
  constructor(
    private nodeId: NodeId,
    private newPath: string,
    private prevPath: string
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, pathData: this.newPath }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, pathData: this.prevPath }))
  }
}

export class RotateNodesCommand implements SceneCommand {
  description = 'Rotate'
  constructor(
    private nodeIds: NodeId[],
    private newTransforms: Map<NodeId, Transform>,
    private prevTransforms: Map<NodeId, Transform>
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      const t = this.newTransforms.get(id)
      if (t) d = updateNode(d, id, (node) => ({ ...node, transform: clone(t) }))
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      const t = this.prevTransforms.get(id)
      if (t) d = updateNode(d, id, (node) => ({ ...node, transform: clone(t) }))
    }
    return d
  }
}

export class FlipNodesCommand implements SceneCommand {
  description = 'Flip'
  constructor(
    private nodeIds: NodeId[],
    private axis: 'horizontal' | 'vertical',
    private prevTransforms: Map<NodeId, Transform>
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      d = updateNode(d, id, (node) => {
        const mirror = node.transform.mirror
        let newMirror: Transform['mirror']
        if (this.axis === 'horizontal') {
          newMirror = mirror === 'none' ? 'horizontal' : mirror === 'horizontal' ? 'none' : mirror === 'vertical' ? 'both' : 'vertical'
        } else {
          newMirror = mirror === 'none' ? 'vertical' : mirror === 'vertical' ? 'none' : mirror === 'horizontal' ? 'both' : 'horizontal'
        }
        return { ...node, transform: { ...node.transform, mirror: newMirror } }
      })
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      const prev = this.prevTransforms.get(id)
      if (prev) d = updateNode(d, id, (node) => ({ ...node, transform: clone(prev) }))
    }
    return d
  }
}

export type AlignmentType =
  | 'left' | 'center-h' | 'right'
  | 'top'  | 'center-v' | 'bottom'

export class AlignNodesCommand implements SceneCommand {
  description: string
  private prevPositions: Map<NodeId, Point2D> = new Map()

  constructor(
    private nodeIds: NodeId[],
    private alignment: AlignmentType
  ) {
    this.description = `Align ${alignment}`
  }

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    this.prevPositions = new Map()

    const positions: Array<{ id: NodeId; x: number; y: number }> = []
    for (const id of this.nodeIds) {
      const result = findNode(d, id)
      if (!result) continue
      const { x, y } = result.node.transform.position
      this.prevPositions.set(id, { x, y })
      positions.push({ id, x, y })
    }
    if (positions.length === 0) return d

    let anchor: number
    const xs = positions.map(p => p.x)
    const ys = positions.map(p => p.y)
    switch (this.alignment) {
      case 'left':     anchor = Math.min(...xs); break
      case 'center-h': anchor = (Math.min(...xs) + Math.max(...xs)) / 2; break
      case 'right':    anchor = Math.max(...xs); break
      case 'top':      anchor = Math.min(...ys); break
      case 'center-v': anchor = (Math.min(...ys) + Math.max(...ys)) / 2; break
      case 'bottom':   anchor = Math.max(...ys); break
    }

    let result = d
    for (const { id, x, y } of positions) {
      const isH = this.alignment === 'left' || this.alignment === 'center-h' || this.alignment === 'right'
      result = updateNode(result, id, (node) => ({
        ...node,
        transform: { ...node.transform, position: { x: isH ? anchor : x, y: isH ? y : anchor } },
      }))
    }
    return result
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const [id, pos] of this.prevPositions) {
      d = updateNode(d, id, (node) => ({
        ...node,
        transform: { ...node.transform, position: { ...pos } },
      }))
    }
    return d
  }
}

export type DistributionAxis = 'horizontal' | 'vertical'

export class DistributeNodesCommand implements SceneCommand {
  description: string
  private prevPositions: Map<NodeId, Point2D> = new Map()

  constructor(
    private nodeIds: NodeId[],
    private axis: DistributionAxis
  ) {
    this.description = `Distribute ${axis}`
  }

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    this.prevPositions = new Map()

    const items: Array<{ id: NodeId; x: number; y: number }> = []
    for (const id of this.nodeIds) {
      const result = findNode(d, id)
      if (!result) continue
      const { x, y } = result.node.transform.position
      this.prevPositions.set(id, { x, y })
      items.push({ id, x, y })
    }
    if (items.length < 3) return d

    if (this.axis === 'horizontal') {
      items.sort((a, b) => a.x - b.x)
      const min = items[0].x
      const step = (items[items.length - 1].x - min) / (items.length - 1)
      let result = d
      for (let i = 0; i < items.length; i++) {
        result = updateNode(result, items[i].id, (node) => ({
          ...node,
          transform: { ...node.transform, position: { x: min + i * step, y: items[i].y } },
        }))
      }
      return result
    } else {
      items.sort((a, b) => a.y - b.y)
      const min = items[0].y
      const step = (items[items.length - 1].y - min) / (items.length - 1)
      let result = d
      for (let i = 0; i < items.length; i++) {
        result = updateNode(result, items[i].id, (node) => ({
          ...node,
          transform: { ...node.transform, position: { x: items[i].x, y: min + i * step } },
        }))
      }
      return result
    }
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const [id, pos] of this.prevPositions) {
      d = updateNode(d, id, (node) => ({
        ...node,
        transform: { ...node.transform, position: { ...pos } },
      }))
    }
    return d
  }
}

// ---------------------------------------------------------------------------
// CompoundCommand — batch multiple commands as one undo step
// ---------------------------------------------------------------------------

export class CompoundCommand implements SceneCommand {
  constructor(
    public description: string,
    private commands: SceneCommand[]
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    let d = doc
    for (const cmd of this.commands) {
      d = cmd.execute(d)
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = doc
    for (const cmd of [...this.commands].reverse()) {
      d = cmd.undo(d)
    }
    return d
  }
}

// ---------------------------------------------------------------------------
// ChangeTextCommand — edit the content of a TextBlock node
// ---------------------------------------------------------------------------

export class ChangeTextCommand implements SceneCommand {
  description = 'Edit Text'
  constructor(
    private nodeId: NodeId,
    private newContent: string,
    private prevContent: string
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, content: this.newContent }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({ ...node, content: this.prevContent }))
  }
}

// ---------------------------------------------------------------------------
// ChangePipeRouteCommand — replace the waypoints of a Pipe node
// ---------------------------------------------------------------------------

export class ChangePipeRouteCommand implements SceneCommand {
  description = 'Reroute Pipe'
  constructor(
    private nodeId: NodeId,
    private newWaypoints: Point2D[],
    private prevWaypoints: Point2D[]
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      waypoints: clone(this.newWaypoints),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      waypoints: clone(this.prevWaypoints),
    }))
  }
}

// ---------------------------------------------------------------------------
// AddDisplayElementCommand — add a DisplayElement to a SymbolInstance
// ---------------------------------------------------------------------------

export class AddDisplayElementCommand implements SceneCommand {
  description = 'Add Display Element'
  constructor(
    private symbolId: NodeId,
    private element: DisplayElement
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.symbolId, (node) => {
      const children = [...((node as { children?: DisplayElement[] }).children ?? []), clone(this.element)]
      return { ...node, children }
    })
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const elemId = this.element.id
    return updateNode(clone(doc), this.symbolId, (node) => {
      const children = ((node as { children?: DisplayElement[] }).children ?? []).filter(
        (c) => c.id !== elemId
      )
      return { ...node, children }
    })
  }
}

// ---------------------------------------------------------------------------
// ChangeDisplayElementConfigCommand — update config on a DisplayElement
// ---------------------------------------------------------------------------

export class ChangeDisplayElementConfigCommand implements SceneCommand {
  description = 'Change Display Element'
  constructor(
    private nodeId: NodeId,
    private newConfig: DisplayElementConfig,
    private prevConfig: DisplayElementConfig
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      config: clone(this.newConfig),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      config: clone(this.prevConfig),
    }))
  }
}

// ---------------------------------------------------------------------------
// ChangeWidgetConfigCommand — update the config object on a Widget node
// ---------------------------------------------------------------------------

export class ChangeWidgetConfigCommand implements SceneCommand {
  description = 'Change Widget'
  constructor(
    private nodeId: NodeId,
    private newConfig: unknown,
    private prevConfig: unknown
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      config: clone(this.newConfig),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      config: clone(this.prevConfig),
    }))
  }
}

// ---------------------------------------------------------------------------
// BulkPropertyChangeCommand — set the same property on multiple nodes
// ---------------------------------------------------------------------------

export class BulkPropertyChangeCommand implements SceneCommand {
  description = 'Bulk Change'
  constructor(
    private nodeIds: NodeId[],
    private property: string,
    private newValue: unknown,
    private prevValues: Map<NodeId, unknown>
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      d = updateNode(d, id, (node) => ({ ...node, [this.property]: clone(this.newValue) }))
    }
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    let d = clone(doc)
    for (const id of this.nodeIds) {
      const prev = this.prevValues.get(id)
      if (prev !== undefined) {
        d = updateNode(d, id, (node) => ({ ...node, [this.property]: clone(prev) }))
      }
    }
    return d
  }
}

// ---------------------------------------------------------------------------
// ChangeLayerPropertyCommand — rename, hide, or lock a layer
// ---------------------------------------------------------------------------

export class ChangeLayerPropertyCommand implements SceneCommand {
  description = 'Change Layer'
  constructor(
    private layerId: string,
    private patch: Partial<Pick<LayerDefinition, 'name' | 'visible' | 'locked'>>,
    private prevPatch: Partial<Pick<LayerDefinition, 'name' | 'visible' | 'locked'>>
  ) {}

  private applyPatch(doc: GraphicDocument, patch: Partial<LayerDefinition>): GraphicDocument {
    const d = clone(doc)
    d.layers = d.layers.map((l) =>
      l.id === this.layerId ? { ...l, ...patch } : l
    )
    return d
  }

  execute(doc: GraphicDocument): GraphicDocument {
    return this.applyPatch(doc, this.patch)
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return this.applyPatch(doc, this.prevPatch)
  }
}

// ---------------------------------------------------------------------------
// ChangeExpressionCommand — add, update, or remove a document-level expression
// ---------------------------------------------------------------------------

export class ChangeExpressionCommand implements SceneCommand {
  description = 'Change Expression'
  constructor(
    private key: string,
    private newExpr: GraphicExpression | null,
    private prevExpr: GraphicExpression | null
  ) {}

  private applyExpr(doc: GraphicDocument, expr: GraphicExpression | null): GraphicDocument {
    const d = clone(doc)
    if (expr === null) {
      const { [this.key]: _removed, ...rest } = d.expressions
      d.expressions = rest
    } else {
      d.expressions = { ...d.expressions, [this.key]: clone(expr) }
    }
    return d
  }

  execute(doc: GraphicDocument): GraphicDocument {
    return this.applyExpr(doc, this.newExpr)
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return this.applyExpr(doc, this.prevExpr)
  }
}

// ---------------------------------------------------------------------------
// ChangeNavigationLinkCommand — set or clear a navigation link on a node
// ---------------------------------------------------------------------------

export class ChangeNavigationLinkCommand implements SceneCommand {
  description = 'Change Navigation Link'
  constructor(
    private nodeId: NodeId,
    private newLink: NavigationLink | undefined,
    private prevLink: NavigationLink | undefined
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      navigationLink: this.newLink ? clone(this.newLink) : undefined,
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      navigationLink: this.prevLink ? clone(this.prevLink) : undefined,
    }))
  }
}

// ---------------------------------------------------------------------------
// ChangeShapeVariantCommand — change the variant/option on a SymbolInstance
// ---------------------------------------------------------------------------

export class ChangeShapeVariantCommand implements SceneCommand {
  description = 'Change Shape Variant'
  constructor(
    private nodeId: NodeId,
    private newVariantId: string,
    private prevVariantId: string | undefined
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      selectedVariantId: this.newVariantId,
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      selectedVariantId: this.prevVariantId,
    }))
  }
}

// ---------------------------------------------------------------------------
// ChangeShapeConfigurationCommand — change shapeRef.configuration on a SymbolInstance
// ---------------------------------------------------------------------------

export class ChangeShapeConfigurationCommand implements SceneCommand {
  description = 'Change Shape Configuration'
  constructor(
    private nodeId: NodeId,
    private newConfig: string | undefined,
    private prevConfig: string | undefined
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      shapeRef: { ...(node as { shapeRef: Record<string, unknown> }).shapeRef, configuration: this.newConfig },
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      shapeRef: { ...(node as { shapeRef: Record<string, unknown> }).shapeRef, configuration: this.prevConfig },
    }))
  }
}

// ---------------------------------------------------------------------------
// AddComposablePartCommand — attach a ComposablePart to a SymbolInstance
// ---------------------------------------------------------------------------

export class AddComposablePartCommand implements SceneCommand {
  description = 'Add Part'
  constructor(
    private symbolId: NodeId,
    private part: ComposablePart
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.symbolId, (node) => {
      const parts = [...((node as { composableParts?: ComposablePart[] }).composableParts ?? []), clone(this.part)]
      return { ...node, composableParts: parts }
    })
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const partId = this.part.partId
    return updateNode(clone(doc), this.symbolId, (node) => {
      const parts = ((node as { composableParts?: ComposablePart[] }).composableParts ?? []).filter(
        (p) => p.partId !== partId
      )
      return { ...node, composableParts: parts }
    })
  }
}

// ---------------------------------------------------------------------------
// RemoveComposablePartCommand — detach a ComposablePart from a SymbolInstance
// ---------------------------------------------------------------------------

export class RemoveComposablePartCommand implements SceneCommand {
  description = 'Remove Part'
  private savedPart: ComposablePart | null = null
  private savedIndex = 0

  constructor(
    private symbolId: NodeId,
    private partId: string
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.symbolId, (node) => {
      const parts = (node as { composableParts?: ComposablePart[] }).composableParts ?? []
      const idx = parts.findIndex((p) => p.partId === this.partId)
      if (idx < 0) return node
      this.savedPart = clone(parts[idx])
      this.savedIndex = idx
      const newParts = parts.filter((p) => p.partId !== this.partId)
      return { ...node, composableParts: newParts }
    })
  }

  undo(doc: GraphicDocument): GraphicDocument {
    if (!this.savedPart) return doc
    const part = this.savedPart
    const idx = this.savedIndex
    return updateNode(clone(doc), this.symbolId, (node) => {
      const parts = [...((node as { composableParts?: ComposablePart[] }).composableParts ?? [])]
      parts.splice(idx, 0, clone(part))
      return { ...node, composableParts: parts }
    })
  }
}

// ---------------------------------------------------------------------------
// ResizePrimitiveCommand — updates both transform position and geometry dimensions
// Used when dragging resize handles on a primitive (rect, ellipse, circle)
// ---------------------------------------------------------------------------

import type { Primitive } from '../types/graphics'

type PrimitiveGeometry = Primitive['geometry']

export class ResizePrimitiveCommand implements SceneCommand {
  description = 'Resize'
  constructor(
    private nodeId: NodeId,
    private newTransform: Transform,
    private newGeometry: PrimitiveGeometry,
    private prevTransform: Transform,
    private prevGeometry: PrimitiveGeometry
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      transform: clone(this.newTransform),
      geometry: clone(this.newGeometry),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      transform: clone(this.prevTransform),
      geometry: clone(this.prevGeometry),
    }))
  }
}

// ---------------------------------------------------------------------------
// ResizeNodeWithDimsCommand — updates transform AND width/height properties
// Used for image and widget nodes where dimensions are stored as separate props
// ---------------------------------------------------------------------------

export class ResizeNodeWithDimsCommand implements SceneCommand {
  description = 'Resize'
  constructor(
    private nodeId: NodeId,
    private newTransform: Transform,
    private newDims: { width: number; height: number },
    private prevTransform: Transform,
    private prevDims: { width: number; height: number },
    private dimKeys: [string, string] = ['width', 'height']
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const [wk, hk] = this.dimKeys
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      transform: clone(this.newTransform),
      [wk]: this.newDims.width,
      [hk]: this.newDims.height,
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const [wk, hk] = this.dimKeys
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      transform: clone(this.prevTransform),
      [wk]: this.prevDims.width,
      [hk]: this.prevDims.height,
    }))
  }
}

// ---------------------------------------------------------------------------
// ChangeDisplayElementTypeCommand — change displayType + reset config, preserve binding
// ---------------------------------------------------------------------------

export class ChangeDisplayElementTypeCommand implements SceneCommand {
  description = 'Change Display Element Type'
  constructor(
    private nodeId: NodeId,
    private newType: string,
    private newConfig: DisplayElementConfig,
    private prevType: string,
    private prevConfig: DisplayElementConfig,
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      displayType: this.newType,
      config: clone(this.newConfig),
    }))
  }

  undo(doc: GraphicDocument): GraphicDocument {
    return updateNode(clone(doc), this.nodeId, (node) => ({
      ...node,
      displayType: this.prevType,
      config: clone(this.prevConfig),
    }))
  }
}

// ---------------------------------------------------------------------------
// DetachDisplayElementCommand — move a DisplayElement from a SymbolInstance
//   child to the doc root, recalculating absolute position
// ---------------------------------------------------------------------------

export class DetachDisplayElementCommand implements SceneCommand {
  description = 'Detach from Shape'
  constructor(
    private nodeId: NodeId,
    private parentId: NodeId,
    private elementSnapshot: DisplayElement,
    private absPosition: { x: number; y: number },
  ) {}

  execute(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    // Remove from parent's children
    const parentResult = findNode(d, this.parentId)
    if (parentResult) {
      const parent = parentResult.node as { children?: SceneNode[] }
      if (parent.children) {
        parent.children = parent.children.filter((c) => c.id !== this.nodeId)
      }
    }
    // Add to doc root with absolute position
    const detached: DisplayElement = {
      ...clone(this.elementSnapshot),
      transform: {
        ...this.elementSnapshot.transform,
        position: { x: this.absPosition.x, y: this.absPosition.y },
      },
    }
    d.children.push(detached as unknown as SceneNode)
    return d
  }

  undo(doc: GraphicDocument): GraphicDocument {
    const d = clone(doc)
    // Remove from doc root
    d.children = d.children.filter((n) => n.id !== this.nodeId)
    // Re-add to parent
    const parentResult = findNode(d, this.parentId)
    if (parentResult) {
      const parent = parentResult.node as { children?: SceneNode[] }
      parent.children = [...(parent.children ?? []), clone(this.elementSnapshot) as unknown as SceneNode]
    }
    return d
  }
}

// ---------------------------------------------------------------------------
// Command history Zustand store
// ---------------------------------------------------------------------------

// useCommandHistory was removed — use historyStore from store/designer/historyStore.ts instead.
