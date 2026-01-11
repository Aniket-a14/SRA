"use client"

import React, { createContext, useContext, useState } from "react"

export type Layer = 1 | 2 | 3 | 4 | 5
export type ValidationStatus = "pending" | "pass" | "fail" | "blocked"

interface LayerState {
    currentLayer: Layer
    maxAllowedLayer: Layer
    validationStatus: ValidationStatus
    isFinalized: boolean
    isLayerLocked: (layer: Layer) => boolean
    setLayer: (layer: Layer) => void
    unlockLayer: (layer: Layer) => void
    unlockAndNavigate: (layer: Layer) => void
    updateValidationStatus: (status: ValidationStatus) => void
    setIsFinalized: (finalized: boolean) => void
}

const LayerContext = createContext<LayerState | undefined>(undefined)

export function LayerProvider({ children }: { children: React.ReactNode }) {
    const [currentLayer, setCurrentLayer] = useState<Layer>(1)
    const [maxAllowedLayer, setMaxAllowedLayer] = useState<Layer>(1)
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>("pending")
    const [isFinalized, setIsFinalized] = useState(false)

    // Helper to check if a layer is accessible
    const isLayerLocked = React.useCallback((layer: Layer) => layer > maxAllowedLayer, [maxAllowedLayer]);

    const setLayer = React.useCallback((layer: Layer) => {
        if (isLayerLocked(layer)) return
        setCurrentLayer(layer)
    }, [isLayerLocked]);

    const unlockLayer = React.useCallback((layer: Layer) => {
        setMaxAllowedLayer(prev => Math.max(prev, layer) as Layer)
    }, []);

    const unlockAndNavigate = React.useCallback((layer: Layer) => {
        setMaxAllowedLayer(prev => Math.max(prev, layer) as Layer)
        setCurrentLayer(layer)
    }, []);

    const updateValidationStatus = React.useCallback((status: ValidationStatus) => {
        setValidationStatus(status)
        if (status === "pass") {
            unlockLayer(3) // Unlock Analysis
        }
    }, [unlockLayer]);

    const value = React.useMemo(() => ({
        currentLayer,
        maxAllowedLayer,
        validationStatus,
        isLayerLocked,
        setLayer,
        unlockLayer,
        unlockAndNavigate,
        updateValidationStatus,
        isFinalized,
        setIsFinalized
    }), [
        currentLayer,
        maxAllowedLayer,
        validationStatus,
        isLayerLocked,
        setLayer,
        unlockLayer,
        unlockAndNavigate,
        updateValidationStatus,
        isFinalized
    ]);

    return (
        <LayerContext.Provider value={value}>
            {children}
        </LayerContext.Provider>
    )
}

export function useLayer() {
    const context = useContext(LayerContext)
    if (context === undefined) {
        throw new Error("useLayer must be used within a LayerProvider")
    }
    return context
}
