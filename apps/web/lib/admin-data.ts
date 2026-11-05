import 'server-only';
import { TEMPLATES } from '@solink/adapters';
export { PARAM_LABELS, PARAM_OWNERS, ROLE_LABEL, dateTime, getParams, verifyAuditChain, type ParamKey } from '@solink/core';
export const TEMPLATES_INFO = Object.entries(TEMPLATES).map(([k, v]) => [k, v.subject] as const);
