import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const valid = {
  VITE_API_BASE_URL: 'http://localhost:5000/api',
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(valid)).toMatchObject({
      enableApiMocking: false,
      mockRole: 'applicant',
      mockDataset: 'real',
      showSampleDataBanner: true,
    });
  });

  it('selects the volume dataset and hides the banner only when asked', () => {
    expect(
      parseEnv({ ...valid, VITE_MOCK_DATASET: 'volume', VITE_SHOW_SAMPLE_DATA_BANNER: 'false' }),
    ).toMatchObject({ mockDataset: 'volume', showSampleDataBanner: false });
    expect(() => parseEnv({ ...valid, VITE_MOCK_DATASET: 'huge' })).toThrow();
  });

  it('fails fast naming every bad variable', () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: 'nope' })).toThrow(EnvError);
    try {
      parseEnv({ VITE_API_BASE_URL: 'nope' });
    } catch (error) {
      expect((error as EnvError).message).toContain('VITE_API_BASE_URL');
      expect((error as EnvError).message).toContain('VITE_CLERK_PUBLISHABLE_KEY');
    }
  });
});
