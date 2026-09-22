import { AUTH_TYPES, AuthType } from '../src/auth-types';

describe('AUTH_TYPES', () => {
  it('contains api_key, subscription, and local', () => {
    expect(AUTH_TYPES).toEqual(['api_key', 'subscription', 'local', 'vertex_adc']);
  });

  it('contains the ADC Vertex auth type', () => {
    expect(AUTH_TYPES).toContain('vertex_adc');
  });

  it('has exactly four entries', () => {
    expect(AUTH_TYPES).toHaveLength(4);
  });
});

describe('AuthType', () => {
  it('accepts valid auth type values', () => {
    const types: AuthType[] = ['api_key', 'subscription', 'local'];
    expect(types).toHaveLength(3);
  });
});
