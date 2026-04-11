import { useState, useEffect } from 'react'

/**
 * Returns the height (px) of the on-screen software keyboard.
 * Uses the Visual Viewport API — when the keyboard opens the visual viewport
 * shrinks, and the gap between it and the layout viewport is the keyboard height.
 * Returns 0 on desktop or when no keyboard is present.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop
      setOffset(Math.max(0, keyboardHeight))
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return offset
}
