/**
 * PasteFromOffice — Tiptap extension
 *
 * Cleans up HTML pasted from Microsoft Word and Google Docs so that
 * ProseMirror can parse it correctly:
 *   - Preserves bold, italic, underline, lists, and table structure
 *   - Strips Word-specific namespace elements and Google Docs wrappers
 *   - Removes inline style noise that would otherwise be ignored anyway
 *
 * This is a self-contained implementation that does not require the
 * @tiptap/extension-paste-from-office Pro package.
 */

import { Extension } from '@tiptap/react'
import { DOMParser as PmDOMParser } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/** Tag names that carry semantic meaning and should be preserved. */
const KEEP_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'IMG', 'SPAN', 'DIV',
])

/**
 * Detect whether the clipboard HTML looks like it came from Word or Google Docs.
 * Word HTML contains <!--StartFragment--> comments and xmlns attributes.
 * Google Docs wraps content in <b id="docs-internal-guid-..."> or adds
 * data-docs attributes.
 */
function isOfficeHtml(html: string): boolean {
  return (
    html.includes('xmlns:w=') ||
    html.includes('xmlns:m=') ||
    html.includes('mso-') ||
    html.includes('docs-internal-guid') ||
    html.includes('<!--StartFragment-->') ||
    html.includes('urn:schemas-microsoft-com')
  )
}

/**
 * Walk a DOM tree and remove nodes/attributes that are Office/Docs-specific
 * while preserving semantic HTML that ProseMirror understands.
 */
function cleanOfficeNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.cloneNode(false)
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    // Comments, processing instructions, etc. — discard
    return null
  }

  const el = node as Element
  const tag = el.tagName.toUpperCase()

  // Google Docs wraps everything in <b id="docs-internal-guid-...">
  // Unwrap it — treat its children as if they were at the top level.
  if (tag === 'B' && el.id.startsWith('docs-internal-guid')) {
    const wrapper = doc.createElement('span')
    for (const child of Array.from(el.childNodes)) {
      const cleaned = cleanOfficeNode(child, doc)
      if (cleaned) wrapper.appendChild(cleaned)
    }
    return wrapper
  }

  // Word uses <o:p> and other namespace tags — replace with <p> or discard
  if (tag.includes(':')) {
    if (tag.endsWith(':P')) {
      const p = doc.createElement('p')
      for (const child of Array.from(el.childNodes)) {
        const cleaned = cleanOfficeNode(child, doc)
        if (cleaned) p.appendChild(cleaned)
      }
      return p
    }
    // Any other namespaced element (o:SmartTagType, w:bookmarkStart, etc.): discard
    return null
  }

  // For recognised semantic tags: clone, clean attributes, recurse into children
  if (KEEP_TAGS.has(tag)) {
    const clone = doc.createElement(el.tagName)

    // Preserve only safe attributes
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (
        name === 'href' ||
        name === 'src' ||
        name === 'alt' ||
        name === 'colspan' ||
        name === 'rowspan'
      ) {
        clone.setAttribute(attr.name, attr.value)
      }
      // Discard class, style, id, xml:* and all Office-specific attrs
    }

    for (const child of Array.from(el.childNodes)) {
      const cleaned = cleanOfficeNode(child, doc)
      if (cleaned) clone.appendChild(cleaned)
    }

    return clone
  }

  // Unknown/presentation-only tag: pass through children without the wrapper
  const wrapper = doc.createElement('span')
  for (const child of Array.from(el.childNodes)) {
    const cleaned = cleanOfficeNode(child, doc)
    if (cleaned) wrapper.appendChild(cleaned)
  }
  return wrapper.hasChildNodes() ? wrapper : null
}

/**
 * Clean an HTML string that originated from Word or Google Docs.
 * Returns a cleaned HTML string suitable for ProseMirror to parse.
 */
function cleanOfficeHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body
  const output = document.createElement('div')

  for (const child of Array.from(body.childNodes)) {
    const cleaned = cleanOfficeNode(child, document)
    if (cleaned) output.appendChild(cleaned)
  }

  return output.innerHTML
}

const pasteFromOfficePluginKey = new PluginKey('pasteFromOffice')

export const PasteFromOffice = Extension.create({
  name: 'pasteFromOffice',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pasteFromOfficePluginKey,
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

            const html = clipboardData.getData('text/html')
            if (!html || !isOfficeHtml(html)) return false

            event.preventDefault()
            event.stopPropagation()

            const cleaned = cleanOfficeHtml(html)
            if (!cleaned.trim()) return false

            const { state, dispatch } = view
            const { schema } = state

            // Parse the cleaned HTML using ProseMirror's DOMParser
            const parser = new DOMParser()
            const cleanedDoc = parser.parseFromString(
              `<body>${cleaned}</body>`,
              'text/html',
            )

            const pmDoc = PmDOMParser.fromSchema(schema).parse(cleanedDoc.body)
            const slice = pmDoc.slice(0)

            const tr = state.tr.replaceSelection(slice)
            dispatch(tr.scrollIntoView())
            return true
          },
        },
      }),
    ]
  },
})
