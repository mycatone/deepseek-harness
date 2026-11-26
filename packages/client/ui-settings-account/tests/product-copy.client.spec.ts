import { afterEach, expect, it, vi } from 'vitest'
import { productAccountCopy } from '../src/client/product-copy.ts'
import { en, zh, ja, es, fr, de, ru, pt } from '../src/client/locales.ts'

afterEach(() => vi.unstubAllEnvs())

it('brands account and onboarding copy in every shipped account locale', () => {
  vi.stubEnv('DSH_CLIENT_TITLE', '555AI')
  vi.stubEnv('DSH_CLIENT_ACCOUNT_NAME', '555AI')
  for (const dictionary of [en, zh, ja, es, fr, de, ru, pt]) {
    const result = productAccountCopy(dictionary)
    expect(result.onboardingBrand).toBe('555AI')
    expect(result.loginDescription).toContain('555AI')
    expect(Object.keys(result)).toEqual(Object.keys(dictionary))
    expect(result.loginDescription).not.toContain('DeepSeek')
  }
})

it('keeps dollar sequences literal and preserves named placeholders', () => {
  vi.stubEnv('DSH_CLIENT_TITLE', 'Next $& <AI>')
  vi.stubEnv('DSH_CLIENT_ACCOUNT_NAME', 'Next $& <AI>')
  expect(productAccountCopy({ text: 'DeepSeek Harness {version} · DeepSeek' }).text)
    .toBe('Next $& <AI> {version} · Next $& <AI>')
})

it('retains ordinary build dictionaries unchanged', () => {
  vi.stubEnv('DSH_CLIENT_TITLE', undefined)
  vi.stubEnv('DSH_CLIENT_ACCOUNT_NAME', undefined)
  expect(productAccountCopy(zh)).toBe(zh)
})

it('does not replace substrings inside the new product name a second time', () => {
  vi.stubEnv('DSH_CLIENT_TITLE', 'DeepSeek Custom')
  vi.stubEnv('DSH_CLIENT_ACCOUNT_NAME', 'DeepSeek Custom')
  expect(productAccountCopy({ text: 'DeepSeek Harness / DeepSeek' }).text)
    .toBe('DeepSeek Custom / DeepSeek Custom')
})
