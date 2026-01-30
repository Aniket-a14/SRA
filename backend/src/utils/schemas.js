import { z } from "zod";

export const IntroductionSchema = z.object({
    projectName: z.string().optional(),
    purpose: z.string(),
    documentConventions: z.string(),
    productScope: z.string(),
    intendedAudience: z.string(),
    references: z.array(z.string()),
});

export const UserCharacteristicSchema = z.object({
    userClass: z.string(),
    characteristics: z.string(),
});

export const OverallDescriptionSchema = z.object({
    productPerspective: z.string(),
    productFunctions: z.array(z.string()),
    userClassesAndCharacteristics: z.array(UserCharacteristicSchema),
    operatingEnvironment: z.string(),
    designAndImplementationConstraints: z.array(z.string()),
    userDocumentation: z.array(z.string()),
    assumptionsAndDependencies: z.array(z.string()),
});

export const ExternalInterfaceRequirementsSchema = z.object({
    userInterfaces: z.string(),
    hardwareInterfaces: z.string(),
    softwareInterfaces: z.string(),
    communicationsInterfaces: z.string(),
});

export const SystemFeatureSchema = z.object({
    name: z.string(),
    description: z.string(),
    stimulusResponseSequences: z.array(z.string()),
    functionalRequirements: z.array(z.string()),
});

export const NonFunctionalRequirementsSchema = z.object({
    performanceRequirements: z.array(z.string()),
    safetyRequirements: z.array(z.string()),
    securityRequirements: z.array(z.string()),
    softwareQualityAttributes: z.array(z.string()),
    businessRules: z.array(z.string()),
});

export const GlossaryItemSchema = z.object({
    term: z.string(),
    definition: z.string(),
});

export const DiagramSchema = z.object({
    code: z.string(),
    caption: z.string(),
    syntaxExplanation: z.string().optional(),
});

export const AnalysisModelsSchema = z.object({
    flowchartDiagram: z.union([DiagramSchema, z.string()]).optional(),
    sequenceDiagram: z.union([DiagramSchema, z.string()]).optional(),
    entityRelationshipDiagram: z.union([DiagramSchema, z.string()]).optional(),
    dataFlowDiagram: z.union([
        z.object({
            level0: z.string(),
            level1: z.string(),
            caption: z.string(),
            syntaxExplanation: z.string().optional(),
        }),
        DiagramSchema,
        z.string(),
    ]).optional(),
});

export const AppendicesSchema = z.object({
    analysisModels: AnalysisModelsSchema,
    tbdList: z.array(z.string()),
});

export const AnalysisResultSchema = z.object({
    projectTitle: z.string(),
    revisionHistory: z.array(z.object({
        version: z.string(),
        date: z.string(),
        description: z.string(),
        author: z.string(),
    })).optional(),
    introduction: IntroductionSchema,
    overallDescription: OverallDescriptionSchema,
    externalInterfaceRequirements: ExternalInterfaceRequirementsSchema,
    systemFeatures: z.array(SystemFeatureSchema),
    nonFunctionalRequirements: NonFunctionalRequirementsSchema,
    otherRequirements: z.array(z.string()),
    glossary: z.array(GlossaryItemSchema),
    appendices: AppendicesSchema,
});
