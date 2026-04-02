import { useCallback, useState } from 'react'

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  const toggle = useCallback(() => setOn((v) => !v), [])
  const setFalse = useCallback(() => setOn(false), [])
  const setTrue = useCallback(() => setOn(true), [])
  return { on, toggle, setFalse, setTrue }
}
