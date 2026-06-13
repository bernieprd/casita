import { useRef, useState, useCallback } from 'react'

const SWIPE_THRESHOLD = 80
const HINT_OFFSET = 32

export function useSwipeAction(onAction: () => void) {
  const startX = useRef(0)
  const isDragging = useRef(false)
  const [offset, setOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const snapBack = useCallback(() => {
    setIsAnimating(true)
    setOffset(0)
    setTimeout(() => setIsAnimating(false), 300)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    isDragging.current = true
    startX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    // Negative offset = swipe left
    const dx = Math.min(0, e.clientX - startX.current)
    setOffset(dx)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const dx = Math.min(0, e.clientX - startX.current)

    if (Math.abs(dx) < 8) {
      // Tap — bounce left as hint then snap back
      setIsAnimating(true)
      setOffset(-HINT_OFFSET)
      setTimeout(() => {
        setOffset(0)
        setTimeout(() => setIsAnimating(false), 300)
      }, 200)
    } else if (dx <= -SWIPE_THRESHOLD) {
      onAction()
      setIsAnimating(true)
      setOffset(0)
      setTimeout(() => setIsAnimating(false), 300)
    } else {
      snapBack()
    }
  }, [onAction, snapBack])

  const onPointerCancel = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    snapBack()
  }, [snapBack])

  return {
    offset,
    isAnimating,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
