import { ieee830, iso29148, volere, agilePrd } from "./specs";
import type { FormatSpec, FormatMeta } from "./types";

export type { FormatSpec, FormatSection, FormatMeta, SectionKind, RequirementShell } from "./types";

const REGISTRY: Record<string, FormatSpec> = {
    ieee830,
    iso29148,
    volere,
    "agile-prd": agilePrd,
};

export const DEFAULT_FORMAT_ID = "ieee830";

export const getFormatSpec = (id?: string | null): FormatSpec => REGISTRY[id || ""] || REGISTRY[DEFAULT_FORMAT_ID];

export const listFormatSpecs = (): FormatMeta[] =>
    Object.values(REGISTRY).map(({ id, name, description, tier }) => ({ id, name, description, tier }));

/** Resolve the format id an analysis was generated with (falls back to IEEE for legacy rows). */
export const resolveFormatId = (data: { formatId?: string } | null | undefined): string =>
    (data?.formatId && REGISTRY[data.formatId]) ? data.formatId : DEFAULT_FORMAT_ID;
