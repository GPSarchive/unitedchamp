'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

export type NodeBox = {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

type Connection = [string, string]

type DragState = {
  id: string
  offsetX: number
  offsetY: number
  pointerId: number
} | null

export default function FlowPlayground() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [nodes, setNodes] = useState<NodeBox[]>([
    { id: 'A', x: 60, y: 60, w: 140, h: 72, label: 'Alpha' },
    { id: 'B', x: 360, y: 240, w: 140, h: 72, label: 'Beta' },
  ])

  const [connections, setConnections] = useState<Connection[]>([["A", "B"]])
  const [drag, setDrag] = useState<DragState>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [clickStart, setClickStart] = useState<{ id: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<{ a: string; b: string } | null>(null)

  const findNode = useCallback((id: string) => nodes.find(n => n.id === id)!, [nodes])

  const toggleConnectMode = () => {
    setConnectMode(prev => !prev)
    setConnectFrom(null)
  }

  const addNode = () => {
    const id = String.fromCharCode(65 + nodes.length)
    const baseX = 40 + (nodes.length % 5) * 160
    const baseY = 40 + Math.floor(nodes.length / 5) * 120
    setNodes(prev => [...prev, { id, x: baseX, y: baseY, w: 140, h: 72, label: `Node ${id}` }])
  }

  const removeAll = () => {
    setNodes([])
    setConnections([])
    setConnectFrom(null)
    setSelected(null)
  }

  const getContainerPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const clampToBounds = (x: number, y: number, w: number, h: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const maxX = Math.max(0, rect.width - w)
    const maxY = Math.max(0, rect.height - h)
    return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) }
  }

  // --- Drag & click detection ---
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const el = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
    const nodeId = el?.dataset?.nodeId
    if (!nodeId) return

    const n = findNode(nodeId)
    const p = getContainerPoint(e.clientX, e.clientY)
    containerRef.current?.setPointerCapture(e.pointerId)
    setDrag({ id: n.id, offsetX: p.x - n.x, offsetY: p.y - n.y, pointerId: e.pointerId })

    setClickStart({ id: n.id, x: e.clientX, y: e.clientY })
  }

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!drag) return
    const p = getContainerPoint(e.clientX, e.clientY)
    setNodes(prev => prev.map(n => {
      if (n.id !== drag.id) return n
      const { x, y } = clampToBounds(p.x - drag.offsetX, p.y - drag.offsetY, n.w, n.h)
      return { ...n, x, y }
    }))
  }

  const endDrag = (pointerId?: number) => {
    if (drag && pointerId !== undefined && drag.pointerId !== pointerId) return
    if (drag) containerRef.current?.releasePointerCapture(drag.pointerId)
    setDrag(null)
  }

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (drag) endDrag(e.pointerId)
    if (clickStart) {
      const dx = Math.abs(e.clientX - clickStart.x)
      const dy = Math.abs(e.clientY - clickStart.y)
      if (dx < 5 && dy < 5) {
        onNodeClick(clickStart.id)
      }
      setClickStart(null)
    }
  }

  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => endDrag(e.pointerId)

  // --- Connect mode logic ---
  const onNodeClick = (id: string) => {
    if (!connectMode) return
    if (!connectFrom) {
      setConnectFrom(id)
      return
    }
    if (connectFrom && connectFrom !== id) {
      setConnections(prev => {
        const exists = prev.some(([a, b]) => (a === connectFrom && b === id) || (a === id && b === connectFrom))
        return exists ? prev : [...prev, [connectFrom, id]]
      })
    }
    setConnectFrom(null)
  }

  // --- Delete connection helpers ---
  const deleteConnection = useCallback((a: string, b: string) => {
    setConnections(prev => prev.filter(([x, y]) => !((x === a && y === b) || (x === b && y === a))))
    setSelected(curr => (curr && ((curr.a === a && curr.b === b) || (curr.a === b && curr.b === a)) ? null : curr))
  }, [])

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      deleteConnection(selected.a, selected.b)
    }
  }

  // Derived positions for SVG lines
  const centers = useMemo(() => {
    const map = new Map<string, { cx: number, cy: number }>()
    for (const n of nodes) map.set(n.id, { cx: n.x + n.w / 2, cy: n.y + n.h / 2 })
    return map
  }, [nodes])

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={addNode} className="px-3 py-2 rounded-2xl shadow border text-sm hover:shadow-md active:scale-[0.98]">Add box</button>
        <button onClick={toggleConnectMode} className={`px-3 py-2 rounded-2xl shadow border text-sm hover:shadow-md active:scale-[0.98] ${connectMode ? 'bg-black text-white' : ''}`}>
          {connectMode ? (connectFrom ? `Pick target for ${connectFrom}` : 'Connect: ON') : 'Connect: OFF'}
        </button>
        {selected && (
          <button onClick={() => deleteConnection(selected.a, selected.b)} className="px-3 py-2 rounded-2xl shadow border text-sm hover:shadow-md active:scale-[0.98]">
            Delete selected link ({selected.a}–{selected.b})
          </button>
        )}
        <button onClick={removeAll} className="px-3 py-2 rounded-2xl shadow border text-sm hover:shadow-md active:scale-[0.98]">Clear</button>
        <div className="text-sm opacity-70 ml-auto">Drag boxes. Connect mode: click two boxes to link. Click a line to select, press Delete, or tap the × handle.</div>
      </div>

      {/* Stage */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        onClick={() => setSelected(null)}
        className="relative w-full h-[600px] rounded-2xl border bg-white overflow-hidden touch-none"
        role="application"
        aria-label="Drag-and-connect canvas"
        tabIndex={0}
      >
        {/* SVG layer for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {connections.map(([a, b], i) => {
            const A = centers.get(a)
            const B = centers.get(b)
            if (!A || !B) return null
            const isSelected = !!selected && ((selected.a === a && selected.b === b) || (selected.a === b && selected.b === a))
            const mx = (A.cx + B.cx) / 2
            const my = (A.cy + B.cy) / 2
            return (
              <g key={i} className="cursor-pointer">
                {/* click line to select */}
                <line
                  x1={A.cx}
                  y1={A.cy}
                  x2={B.cx}
                  y2={B.cy}
                  strokeWidth={isSelected ? 3 : 2}
                  stroke={isSelected ? 'red' : 'black'}
                  markerEnd="url(#arrow)"
                  onClick={(e) => { e.stopPropagation(); setSelected({ a, b }) }}
                />
                {/* small delete handle at midpoint */}
                <circle
                  cx={mx}
                  cy={my}
                  r={10}
                  fill="white"
                  stroke={isSelected ? 'red' : 'black'}
                  onClick={(e) => { e.stopPropagation(); deleteConnection(a, b) }}
                />
                <text x={mx} y={my + 3} textAnchor="middle" fontSize="12" onClick={(e) => { e.stopPropagation(); deleteConnection(a, b) }}>×</text>
              </g>
            )
          })}
        </svg>

        {/* Node boxes */}
        {nodes.map(n => (
          <div
            key={n.id}
            data-node-id={n.id}
            style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
            className={`absolute select-none rounded-2xl border shadow-sm bg-white hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
                        ${drag?.id === n.id ? 'ring-2 ring-black' : ''}`}
          >
            <div className="h-full w-full p-3 flex flex-col">
              <div className="font-medium">{n.label}</div>
              <div className="mt-auto text-xs opacity-70">{n.id}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
