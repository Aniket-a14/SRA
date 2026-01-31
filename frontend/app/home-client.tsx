"use client";

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { HeroSection } from "@/components/hero-section"
import { ChatInput } from "@/components/chat-input"
import { ResultsTabs } from "@/components/results-tabs"
import { AboutSection } from "@/components/about-section"
import { FaqSection } from "@/components/faq-section"
import type { Analysis } from "@/types/analysis"
import { toast } from "sonner"
import { fetchProject } from "@/lib/projects-api"
import { PromptSettings } from "@/types/project";
import { Folder } from "lucide-react"

const defaultAnalysis: Analysis = {
    id: "preview",
    userId: "preview",
    status: "COMPLETED",
    version: 1,
    createdAt: new Date().toISOString(),
    rootId: "preview",
    parentId: null,
    projectTitle: "Untitled Project",
    introduction: {
        purpose: "",
        productScope: "",
        intendedAudience: "",
        documentConventions: "",
        references: []
    },
    overallDescription: {
        productPerspective: "",
        productFunctions: [],
        userClassesAndCharacteristics: [],
        operatingEnvironment: "",
        designAndImplementationConstraints: [],
        userDocumentation: [],
        assumptionsAndDependencies: []
    },
    externalInterfaceRequirements: {
        userInterfaces: "",
        hardwareInterfaces: "",
        softwareInterfaces: "",
        communicationsInterfaces: ""
    },
    systemFeatures: [],
    nonFunctionalRequirements: {
        performanceRequirements: [],
        safetyRequirements: [],
        securityRequirements: [],
        softwareQualityAttributes: [],
        businessRules: []
    },
    otherRequirements: [],
    glossary: [],
    appendices: {
        analysisModels: {},
        tbdList: []
    },
    missingLogic: [],
    contradictions: [],
}

export function HomeClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { authenticateWithToken, token, csrfToken, fetchCsrf } = useAuth()
    const [analysisResult] = useState<Analysis>(defaultAnalysis)

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const projectId = searchParams.get("projectId")
    const [projectName, setProjectName] = useState<string>("")
    const [projectSettings, setProjectSettings] = useState<PromptSettings | null>(null);

    useEffect(() => {
        const urlToken = searchParams.get("token")
        const urlRefreshToken = searchParams.get("refreshToken")
        if (urlToken) {
            authenticateWithToken(urlToken, urlRefreshToken || undefined)
        }
    }, [searchParams, authenticateWithToken])

    useEffect(() => {
        if (projectId && token) {
            fetchProject(token, projectId).then(p => {
                setProjectName(p.name);
                if (p.settings) setProjectSettings(p.settings);
            }).catch(() => setProjectName("Unknown Project"));
        }
    }, [projectId, token])

    const handleAnalyze = async (requirements: string, settings: PromptSettings, name: string) => {
        if (!token) {
            toast.error("You must be logged in to start a project.");
            return;
        }

        // PROACTIVE CSRF REFRESH
        let effectiveCsrf = csrfToken;
        if (!effectiveCsrf) {
            effectiveCsrf = await fetchCsrf();
        }

        setIsAnalyzing(true);
        const loadingToast = toast.loading("Initializing project...");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(effectiveCsrf && { "x-csrf-token": effectiveCsrf })
                },
                body: JSON.stringify({
                    text: requirements,
                    srsData: {
                        introduction: {
                            projectName: { content: name },
                            purpose: { content: requirements },
                        },
                    },
                    projectId: projectId || undefined,
                    settings: settings || undefined,
                    draft: true,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to initialize project.");
            }

            const json = await response.json();
            const data = json.data || json;
            if (data.status === "draft" && data.id) {
                toast.success("Project initialized!", { id: loadingToast });
                router.push(`/analysis/${data.id}`);
            } else {
                throw new Error("Unexpected response from server.");
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to initialize project";
            toast.error(errorMessage, { id: loadingToast });
        } finally {
            setIsAnalyzing(false);
        }
    }

    return (
        <>
            <HeroSection />

            {projectId && (
                <div className="container mx-auto px-4 mt-6 mb-2">
                    <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-md flex items-center gap-2">
                        <Folder size={18} />
                        <span className="font-medium">Analysis Context: <strong>{projectName || "Loading..."}</strong></span>
                    </div>
                </div>
            )}

            <ChatInput onAnalyze={handleAnalyze} isLoading={isAnalyzing} initialSettings={projectSettings || undefined} />
            <ResultsTabs data={analysisResult} />
            <AboutSection />
            <FaqSection />
        </>
    )
}
