export interface UserStory {
    role: string
    feature: string
    benefit: string
    story: string
}

export interface AcceptanceCriteria {
    story: string
    criteria: string[]
}

export interface ApiContract {
    endpoint: string
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
    description: string
    requestBody: Record<string, unknown>
    responseBody: Record<string, unknown>
}

export interface AnalysisResult {
    cleanedRequirements: string
    functionalRequirements: string[]
    nonFunctionalRequirements: string[]
    entities: string[]
    userStories: UserStory[]
    acceptanceCriteria: AcceptanceCriteria[]
    flowchartDiagram: string
    sequenceDiagram: string
    apiContracts: ApiContract[]
    missingLogic: string[]
    contradictions?: string[]
    qualityAudit?: {
        score: number
        issues: string[]

    }
    projectTitle?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generatedCode?: any
}

export interface Analysis extends AnalysisResult {
    id: string
    userId: string
    inputText: string
    resultJson?: AnalysisResult // Kept checking legacy/optional just in case, but main data is flattened
    version: number
    title?: string
    createdAt: string
    rootId: string | null
    parentId: string | null
}
