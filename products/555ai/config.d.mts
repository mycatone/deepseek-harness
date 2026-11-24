/** Editable public identity; slug and appId remain stable when displayName changes. */
export interface ProductConfig {
  displayName: string
  slug: string
  appId: string
  accountOrigin: string
  inferenceOrigin: string
  icons: null
}
export function validateProduct(value: unknown): ProductConfig
export function readProductConfig(path?: string | URL): ProductConfig
export function productEnvironment(product: ProductConfig, base?: Record<string, string | undefined>): Record<string, string | undefined>
export function prepareProductHome(product: ProductConfig, home: string): string
