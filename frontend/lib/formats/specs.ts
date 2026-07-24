import type { FormatSpec } from "./types";

/**
 * Frontend format descriptors — mirror of backend/src/formats/specs/*. Section ids match the
 * top-level keys of resultJson for each format (IEEE keeps its legacy flat keys).
 */

export const ieee830: FormatSpec = {
    id: "ieee830",
    name: "IEEE 830-1998",
    description: "Classic Software Requirements Specification (6 chapters + appendices).",
    tier: "detailed",
    legacyPipeline: true,
    coverSubtitle: "Software Requirements Specification",
    requirementModel: "ieee",
    sections: [
        {
            id: "introduction", number: "1", title: "Introduction", kind: "group",
            fields: [
                { id: "purpose", label: "Purpose", kind: "prose" },
                { id: "documentConventions", label: "Document Conventions", kind: "prose" },
                { id: "intendedAudience", label: "Intended Audience and Reading Suggestions", kind: "prose" },
                { id: "productScope", label: "Product Scope", kind: "prose" },
                { id: "references", label: "References", kind: "list" },
            ],
        },
        {
            id: "overallDescription", number: "2", title: "Overall Description", kind: "group",
            fields: [
                { id: "productPerspective", label: "Product Perspective", kind: "prose" },
                { id: "productFunctions", label: "Product Functions", kind: "list" },
                { id: "userClassesAndCharacteristics", label: "User Classes and Characteristics", kind: "user-classes" },
                { id: "operatingEnvironment", label: "Operating Environment", kind: "prose" },
                { id: "designAndImplementationConstraints", label: "Design and Implementation Constraints", kind: "list" },
                { id: "userDocumentation", label: "User Documentation", kind: "list" },
                { id: "assumptionsAndDependencies", label: "Assumptions and Dependencies", kind: "list" },
            ],
        },
        {
            id: "externalInterfaceRequirements", number: "3", title: "External Interface Requirements", kind: "group",
            fields: [
                { id: "userInterfaces", label: "User Interfaces", kind: "prose" },
                { id: "hardwareInterfaces", label: "Hardware Interfaces", kind: "prose" },
                { id: "softwareInterfaces", label: "Software Interfaces", kind: "prose" },
                { id: "communicationsInterfaces", label: "Communications Interfaces", kind: "prose" },
            ],
        },
        { id: "systemFeatures", number: "4", title: "System Features", kind: "feature-list", requirementModel: "ieee" },
        {
            id: "nonFunctionalRequirements", number: "5", title: "Other Nonfunctional Requirements", kind: "group",
            fields: [
                { id: "performanceRequirements", label: "Performance Requirements", kind: "list" },
                { id: "safetyRequirements", label: "Safety Requirements", kind: "list" },
                { id: "securityRequirements", label: "Security Requirements", kind: "list" },
                { id: "softwareQualityAttributes", label: "Software Quality Attributes", kind: "list" },
                { id: "businessRules", label: "Business Rules", kind: "list" },
            ],
        },
        { id: "otherRequirements", number: "6", title: "Other Requirements", kind: "list" },
        { id: "glossary", number: "A", title: "Glossary", kind: "glossary", appendix: true },
        { id: "appendices", number: "B", title: "Analysis Models", kind: "diagrams", appendix: true },
    ],
};

export const iso29148: FormatSpec = {
    id: "iso29148",
    name: "ISO/IEC/IEEE 29148:2018",
    description: "Modern requirements-engineering standard (successor to IEEE 830).",
    tier: "detailed",
    coverSubtitle: "System/Software Requirements Specification",
    requirementModel: "ieee",
    sections: [
        {
            id: "introduction", number: "1", title: "Introduction", kind: "group",
            fields: [
                { id: "purpose", label: "Purpose", kind: "prose" },
                { id: "scope", label: "Scope", kind: "prose" },
                { id: "productPerspective", label: "Product Perspective", kind: "prose" },
                { id: "productFunctions", label: "Product Functions", kind: "list" },
                { id: "userCharacteristics", label: "User Characteristics", kind: "user-classes" },
                { id: "constraints", label: "Limitations and Constraints", kind: "list" },
                { id: "assumptionsAndDependencies", label: "Assumptions and Dependencies", kind: "list" },
            ],
        },
        { id: "references", number: "2", title: "References", kind: "list" },
        {
            id: "specificRequirements", number: "3", title: "External Interfaces", kind: "group",
            fields: [
                { id: "userInterfaces", label: "User Interfaces", kind: "prose" },
                { id: "hardwareInterfaces", label: "Hardware Interfaces", kind: "prose" },
                { id: "softwareInterfaces", label: "Software Interfaces", kind: "prose" },
                { id: "communicationsInterfaces", label: "Communications Interfaces", kind: "prose" },
            ],
        },
        { id: "systemFunctions", number: "4", title: "System Functions", kind: "feature-list", requirementModel: "ieee" },
        {
            id: "systemAttributes", number: "5", title: "Software System Attributes", kind: "group",
            fields: [
                { id: "performance", label: "Performance Requirements", kind: "list" },
                { id: "security", label: "Security", kind: "list" },
                { id: "safety", label: "Safety", kind: "list" },
                { id: "qualityAttributes", label: "Software Quality Attributes", kind: "list" },
                { id: "businessRules", label: "Business Rules", kind: "list" },
            ],
        },
        { id: "verification", number: "6", title: "Verification", kind: "prose" },
        { id: "glossary", number: "A", title: "Definitions", kind: "glossary", appendix: true },
        { id: "appendices", number: "B", title: "Analysis Models", kind: "diagrams", appendix: true },
    ],
};

export const volere: FormatSpec = {
    id: "volere",
    name: "Volere",
    description: "Robertson Volere template — use-case driven, requirement shells with fit criteria.",
    tier: "detailed",
    coverSubtitle: "Requirements Specification",
    requirementModel: "volere-shell",
    sections: [
        {
            id: "purpose", number: "1", title: "The Purpose of the Project", kind: "group",
            fields: [
                { id: "businessProblem", label: "The Background of the Project Effort", kind: "prose" },
                { id: "goals", label: "Goals of the Project", kind: "list" },
            ],
        },
        { id: "stakeholders", number: "2", title: "Stakeholders", kind: "stakeholders" },
        {
            id: "constraints", number: "3", title: "Constraints", kind: "group",
            fields: [
                { id: "solutionConstraints", label: "Solution Constraints", kind: "list" },
                { id: "implementationEnvironment", label: "Implementation Environment", kind: "prose" },
                { id: "assumptions", label: "Assumptions", kind: "list" },
            ],
        },
        { id: "namingConventions", number: "4", title: "Naming Conventions and Terminology", kind: "glossary" },
        { id: "functionalRequirements", number: "5", title: "Functional Requirements", kind: "feature-list", requirementModel: "volere-shell" },
        {
            id: "nonFunctionalRequirements", number: "6", title: "Non-functional Requirements", kind: "group",
            fields: [
                { id: "lookAndFeel", label: "Look and Feel Requirements", kind: "shell-list" },
                { id: "usability", label: "Usability and Humanity Requirements", kind: "shell-list" },
                { id: "performance", label: "Performance Requirements", kind: "shell-list" },
                { id: "operational", label: "Operational and Environmental Requirements", kind: "shell-list" },
                { id: "maintainability", label: "Maintainability and Support Requirements", kind: "shell-list" },
                { id: "security", label: "Security Requirements", kind: "shell-list" },
                { id: "cultural", label: "Cultural and Political Requirements", kind: "shell-list" },
                { id: "legal", label: "Legal Requirements", kind: "shell-list" },
            ],
        },
        { id: "projectIssues", number: "7", title: "Project Issues", kind: "issues" },
        { id: "appendices", number: "A", title: "Analysis Models", kind: "diagrams", appendix: true },
    ],
};

export const agilePrd: FormatSpec = {
    id: "agile-prd",
    name: "Agile PRD",
    description: "Lightweight Product Requirements Document with personas and user stories.",
    tier: "light",
    coverSubtitle: "Product Requirements Document",
    requirementModel: "story",
    sections: [
        {
            id: "overview", number: "1", title: "Overview", kind: "group",
            fields: [
                { id: "vision", label: "Vision", kind: "prose" },
                { id: "problem", label: "Problem Statement", kind: "prose" },
            ],
        },
        { id: "objectives", number: "2", title: "Goals and Objectives", kind: "list" },
        { id: "personas", number: "3", title: "Personas", kind: "personas" },
        { id: "userStories", number: "4", title: "User Stories", kind: "user-stories" },
        { id: "nonFunctionalRequirements", number: "5", title: "Non-Functional Requirements", kind: "list" },
        { id: "openQuestions", number: "6", title: "Open Questions", kind: "list" },
        { id: "glossary", number: "7", title: "Glossary", kind: "glossary" },
    ],
};
