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
    requestBody: Record<string, any>
    responseBody: Record<string, any>
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
}
