// DYNAMIC PROMPT GENERATOR
import { registerPromptVersion, getPromptByVersion, getLatestVersion } from './promptRegistry.js';
import logger from '../config/logger.js';
import * as v1 from './versions/v1_0_0.js';
import * as v1_1 from './versions/v1_1_0.js';
import * as v2 from './versions/v2_0_0.js';
import * as v2_1 from './versions/v2_1_0.js';
import * as v2_2 from './versions/v2_2_0.js';

import { DIAGRAM_AUTHORITY_PROMPT } from './prompt_templates/diagram_authority.js';
import { CHAT_PROMPT, CHAT_REPLY_PROMPT, CHAT_EDIT_PROMPT } from './prompt_templates/chat.js';
import { FEATURE_EXPANSION_PROMPT } from './prompt_templates/feature_expansion.js';
import { ALIGNMENT_CHECK_PROMPT } from './prompt_templates/alignment_check.js';
import { DIAGRAM_REPAIR_PROMPT } from './prompt_templates/diagram_repair.js';
import { DFD_STRUCT_GEN_PROMPT } from './prompt_templates/dfd_struct_gen.js';


// 1. REGISTER VERSIONS
// NOTE: older versions are kept registered for explicit backward-compatible version selection
// via API (e.g. promptVersion: "2.0.0"). They are NOT the active default — getLatestVersion()
// uses semver sorting and will always resolve to the highest registered version. Do NOT remove them.
registerPromptVersion('1.0.0', v1.generate);
registerPromptVersion('1.1.0', v1_1.generate);
registerPromptVersion('2.0.0', v2.generate);   // Legacy — 25KB, kept for API compatibility
registerPromptVersion('2.1.0', v2_1.generate); // Legacy — optimised 11KB, kept for rollback
registerPromptVersion('2.2.0', v2_2.generate); // Active default — enterprise-grade, IEEE output unchanged

// 2. CENTRAL FACTORY
// Now ASYNC because generators allow I/O
export const constructMasterPrompt = async (text = null, settings = {}, version = 'latest') => {
  const v = version === 'latest' ? getLatestVersion() : version;
  if (version !== 'latest') {
    logger.info(`[Governance] Using explicit prompt version: ${v}`);
  }
  const generator = getPromptByVersion(v);
  return await generator(text, settings);
};

// Re-export constants for compatibility
export {
  DIAGRAM_AUTHORITY_PROMPT,
  CHAT_PROMPT,
  CHAT_REPLY_PROMPT,
  CHAT_EDIT_PROMPT,
  FEATURE_EXPANSION_PROMPT,
  ALIGNMENT_CHECK_PROMPT,
  DIAGRAM_REPAIR_PROMPT,
  DFD_STRUCT_GEN_PROMPT
};
