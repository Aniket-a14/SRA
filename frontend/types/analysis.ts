export interface RevisionHistoryItem {
    version: string;
    date: string;
    description: string;
    author: string;
}

export interface Introduction {
    purpose: string;
    documentConventions: string;
    scope: string;
    intendedAudience: string;
    references: string[];
}

export interface UserCharacteristic {
    userClass: string;
    characteristics: string;
}

export interface UserStory {
    role: string;
    feature: string;
    benefit: string;
    story: string;
}

export interface OverallDescription {
    productPerspective: string;
    productFunctions: string[];
    userClassesAndCharacteristics: UserCharacteristic[];
    operatingEnvironment: string;
    designAndImplementationConstraints: string[];
    userDocumentation: string[];
    assumptionsAndDependencies: string[];
}

export interface ExternalInterfaceRequirements {
    userInterfaces: string;
    hardwareInterfaces: string;
    softwareInterfaces: string;
    communicationsInterfaces: string;
}

export interface SystemFeature {
    name: string;
    description: string;
    stimulusResponseSequences: string[];
    functionalRequirements: string[];
}

export interface NonFunctionalRequirements {
    performanceRequirements: string[];
    safetyRequirements: string[];
    securityRequirements: string[];
    softwareQualityAttributes: string[];
    businessRules: string[];
}

export interface GlossaryItem {
    term: string;
    definition: string;
}

export interface Diagram {
    code: string;
    caption: string;
}

export interface AnalysisModels {
    flowchartDiagram?: Diagram | string;
    sequenceDiagram?: Diagram | string;
    entityRelationshipDiagram?: Diagram | string;
    dataFlowDiagram?: Diagram | string;
}

export interface Appendices {
    analysisModels: AnalysisModels;
    tbdList: string[];
}

export interface AnalysisResult {
    // New IEEE Structure
    projectTitle: string;
    revisionHistory?: RevisionHistoryItem[];
    introduction: Introduction;
    overallDescription: OverallDescription;
    externalInterfaceRequirements: ExternalInterfaceRequirements;
    systemFeatures: SystemFeature[];
    nonFunctionalRequirements: NonFunctionalRequirements;
    otherRequirements: string[];
    glossary: GlossaryItem[];
    appendices: Appendices;

    // Legacy / Auxiliary fields
    missingLogic?: string[];
    contradictions?: string[];
    qualityAudit?: {
        score: number
        issues: string[]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generatedCode?: any
}

export interface Analysis extends AnalysisResult {
    id: string
    userId: string
    inputText: string
    resultJson?: AnalysisResult
    version: number
    title?: string
    createdAt: string
    rootId: string | null
    parentId: string | null
}
