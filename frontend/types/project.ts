import { Analysis } from './analysis';

export interface Project {
    id: string;
    name: string;
    description?: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    analyses?: Analysis[];
    _count?: {
        analyses: number;
    }
}
