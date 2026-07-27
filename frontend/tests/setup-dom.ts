import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Unmount between tests so queries never match a previous render's leftovers.
afterEach(() => {
    cleanup()
})

// jsdom implements neither of these, and components that lazy-render on visibility or read
// layout on mount will throw without them.
if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
}

// Nor a usable Storage. auth-context caches the access token and user here, so without it
// every test touching authentication throws before it reaches the behaviour under test.
if (typeof window.localStorage?.setItem !== "function") {
    const createStorage = (): Storage => {
        let entries: Record<string, string> = {}
        return {
            getItem: (key: string) => (key in entries ? entries[key] : null),
            setItem: (key: string, value: string) => { entries[key] = String(value) },
            removeItem: (key: string) => { delete entries[key] },
            clear: () => { entries = {} },
            key: (index: number) => Object.keys(entries)[index] ?? null,
            get length() { return Object.keys(entries).length },
        } as Storage
    }
    Object.defineProperty(window, "localStorage", { value: createStorage(), writable: true })
    Object.defineProperty(window, "sessionStorage", { value: createStorage(), writable: true })
}

if (!window.ResizeObserver) {
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof window.ResizeObserver
}
