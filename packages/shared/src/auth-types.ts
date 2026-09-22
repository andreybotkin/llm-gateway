export const AUTH_TYPES = ['api_key', 'subscription', 'local', 'vertex_adc'] as const;
export type AuthType = (typeof AUTH_TYPES)[number];
