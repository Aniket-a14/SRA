"use client"

import { useEffect, useRef, useState } from "react"

// The pipeline writes the document in separate model calls with deliberate cooldowns between
// them, so tokens arrive in bursts with multi-second silences in between. Rendering them as they
// land makes the page lurch and then freeze. Everything received is held in a buffer and released
// at a rate set by how much is waiting, so the gaps between calls are spent reading rather than
// staring at a stalled page.

export const TICK_MS = 40

// Each tick releases this fraction of whatever is waiting, so a deep backlog catches up quickly
// and then eases off. The last stretch trickles at MIN_CHARS — 25 chars/s, slow but never still.
export const DRAIN_DIVISOR = 45

export const MIN_CHARS = 1

// Fast enough to clear a burst, slow enough to still read as writing rather than a paste.
export const MAX_CHARS = 60

/**
 * One tick of the window: how much of `source` should be on screen given what already is.
 * Pure, because the pacing rule is the part worth testing.
 */
export function nextShown(shown: string, source: string): string {
    // A retry restarts the section and replays it, so the buffer can shrink or diverge.
    if (!source.startsWith(shown)) return source

    const pending = source.length - shown.length
    if (pending <= 0) return shown

    const step = Math.min(Math.max(Math.ceil(pending / DRAIN_DIVISOR), MIN_CHARS), MAX_CHARS)
    return source.slice(0, shown.length + step)
}

/**
 * Reveals `source` progressively. `started` latches on the first visible character and never
 * clears, so a reset between two model calls cannot send the caller back to its empty state.
 */
export function usePacedText(source: string): { shown: string, started: boolean } {
    const [state, setState] = useState({ shown: "", started: false })
    const sourceRef = useRef(source)

    useEffect(() => { sourceRef.current = source }, [source])

    useEffect(() => {
        const id = setInterval(() => {
            setState(prev => {
                const shown = nextShown(prev.shown, sourceRef.current)
                const started = prev.started || shown.length > 0
                if (shown === prev.shown && started === prev.started) return prev
                return { shown, started }
            })
        }, TICK_MS)
        return () => clearInterval(id)
    }, [])

    return state
}
