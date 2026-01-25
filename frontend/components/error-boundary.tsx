"use client"

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Uncaught error in ${this.props.name || 'Component'}:`, error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-xl text-center space-y-4 min-h-[200px]">
                    <div className="bg-destructive/10 p-3 rounded-full">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-destructive">Something went wrong</h3>
                        <p className="text-sm text-muted-foreground max-w-[300px]">
                            {this.state.error?.message || `Failed to render ${this.props.name || 'this component'}.`}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="gap-2"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
