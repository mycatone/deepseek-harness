/** Build-time product and account names in the locale-owned account dictionaries. */

/**
 * Preserve dictionary keys and placeholders while replacing product identity literally.
 * @param dictionary - One complete locale dictionary.
 * @returns Original dictionary for an ordinary build, otherwise its branded copy.
 */
export function productAccountCopy<T extends Record<string, string>>(dictionary: T): T {
  const product = process.env.DSH_CLIENT_TITLE
  const account = process.env.DSH_CLIENT_ACCOUNT_NAME
  if (product === undefined && account === undefined) return dictionary
  return Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key,
    value.replace(/DeepSeek Harness|DeepSeek/gu,
      matched => matched === 'DeepSeek Harness' ? product ?? matched : account ?? matched),
  ])) as T
}
