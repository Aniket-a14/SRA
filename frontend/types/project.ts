import { Analysis } from './analysis';

export interface PromptSettings {
    profile: string;
    depth: number;
    strictness: number;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    settings?: PromptSettings;
    userId: string;
    createdAt: string;
    updatedAt: string;
    analyses?: Analysis[];
    _count?: {
        analyses: number;
    }
}
