// DYNAMIC PROMPT GENERATOR
import { registerPromptVersion, getPromptByVersion, getLatestVersion } from './promptRegistry.js';
import logger from '../config/logger.js';
import * as v1 from './versions/v1_0_0.js';
import * as v1_1 from './versions/v1_1_0.js';

import { DIAGRAM_AUTHORITY_PROMPT } from './prompt_templates/diagram_authority.js';
import { CHAT_PROMPT } from './prompt_templates/chat.js';
import { FEATURE_EXPANSION_PROMPT } from './prompt_templates/feature_expansion.js';
import { CODE_GEN_PROMPT } from './prompt_templates/code_gen.js';
import { ALIGNMENT_CHECK_PROMPT } from './prompt_templates/alignment_check.js';
import { DIAGRAM_REPAIR_PROMPT } from './prompt_templates/diagram_repair.js';
import { DFD_STRUCT_GEN_PROMPT } from './prompt_templates/dfd_struct_gen.js';


// 1. REGISTER VERSIONS
registerPromptVersion('1.0.0', v1.generate);
registerPromptVersion('1.1.0', v1_1.generate);

// 2. CENTRAL FACTORY
// Now ASYNC because generators allow I/O
export const constructMasterPrompt = async (settings = {}, version = 'latest') => {
  const v = version === 'latest' ? getLatestVersion() : version;
  if (version !== 'latest') {
    logger.info(`[Governance] Using explicit prompt version: ${v}`);
  }
  const generator = getPromptByVersion(v);
  return await generator(settings);
};

// Re-export constants for compatibility
export {
  DIAGRAM_AUTHORITY_PROMPT,
  CHAT_PROMPT,
  FEATURE_EXPANSION_PROMPT,
  CODE_GEN_PROMPT,
  ALIGNMENT_CHECK_PROMPT,
  DIAGRAM_REPAIR_PROMPT,
  DFD_STRUCT_GEN_PROMPT
};

