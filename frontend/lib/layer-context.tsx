"use client"

import React, { createContext, useContext, useState } from "react"

export type Layer = 1 | 2 | 3 | 4 | 5
export type ValidationStatus = "pending" | "pass" | "fail" | "blocked"

interface LayerState {
    currentLayer: Layer
    maxAllowedLayer: Layer
    validationStatus: ValidationStatus
    isLayerLocked: (layer: Layer) => boolean
    setLayer: (layer: Layer) => void
    unlockLayer: (layer: Layer) => void
    unlockAndNavigate: (layer: Layer) => void
    updateValidationStatus: (status: ValidationStatus) => void
}

const LayerContext = createContext<LayerState | undefined>(undefined)

export function LayerProvider({ children }: { children: React.ReactNode }) {
    const [currentLayer, setCurrentLayer] = useState<Layer>(1)
    const [maxAllowedLayer, setMaxAllowedLayer] = useState<Layer>(1)
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>("pending")

    // Helper to check if a layer is accessible
    const isLayerLocked = (layer: Layer) => layer > maxAllowedLayer

    const setLayer = (layer: Layer) => {
        if (isLayerLocked(layer)) return
        setCurrentLayer(layer)
    }

    const unlockLayer = (layer: Layer) => {
        setMaxAllowedLayer(prev => Math.max(prev, layer) as Layer)
    }

    const unlockAndNavigate = (layer: Layer) => {
        setMaxAllowedLayer(prev => Math.max(prev, layer) as Layer)
        setCurrentLayer(layer)
    }

    const updateValidationStatus = (status: ValidationStatus) => {
        setValidationStatus(status)
        if (status === "pass") {
            unlockLayer(3) // Unlock Analysis
        }
    }

    return (
        <LayerContext.Provider value={{
            currentLayer,
            maxAllowedLayer,
            validationStatus,
            isLayerLocked,
            setLayer,
            unlockLayer,
            unlockAndNavigate,
            updateValidationStatus
        }}>
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
