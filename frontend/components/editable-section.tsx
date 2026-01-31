"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus, GripVertical, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface EditableSectionProps {
    items: string[]
    isEditing: boolean
    onUpdate: (newItems: string[]) => void
    prefix?: string
    badgeColor?: string
}

export function EditableSection({ items, isEditing, onUpdate, prefix = "ITEM", badgeColor = "text-primary" }: EditableSectionProps) {
    const [localItems, setLocalItems] = useState(items)

    useEffect(() => {
        setLocalItems(items)
    }, [items])

    const handleChange = (index: number, value: string) => {
        const newItems = [...localItems]
        newItems[index] = value
        setLocalItems(newItems)
        onUpdate(newItems)
    }

    const handleDelete = (index: number) => {
        const newItems = localItems.filter((_, i) => i !== index)
        setLocalItems(newItems)
        onUpdate(newItems)
    }

    const handleAdd = () => {
        const newItems = [...localItems, "New requirement..."]
        setLocalItems(newItems)
        onUpdate(newItems)
    }

    if (!isEditing) {
        return (
            <ul className="space-y-3">
                {items.length > 0 ? (
                    items.map((req, index) => (
                        <li
                            key={index}
                            className="flex items-start gap-3 transition-all duration-300 hover:translate-x-1"
                        >
                            <Badge variant="outline" className={`shrink-0 mt-0.5 border-primary/50 ${badgeColor}`}>
                                {prefix}-{String(index + 1).padStart(2, "0")}
                            </Badge>
                            <span className="text-sm leading-relaxed">{req}</span>
                        </li>
                    ))
                ) : (
                    <span className="text-sm text-muted-foreground">No items found.</span>
                )}
            </ul>
        )
    }

    return (
        <div className="space-y-4">
            {localItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-start group">
                    <div className="mt-2 text-muted-foreground cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className={`shrink-0 mt-2 border-primary/50 ${badgeColor}`}>
                        {prefix}-{String(index + 1).padStart(2, "0")}
                    </Badge>
                    <Textarea
                        value={item}
                        onChange={(e) => handleChange(index, e.target.value)}
                        className="min-h-[60px] flex-1 resize-y"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(index)}
                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        aria-label={`Delete item ${index + 1}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAdd} className="w-full border-dashed">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
            </Button>
        </div>
    )
}
