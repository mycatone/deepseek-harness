/**
 * Dynamic model metadata discovery for OpenAI-compatible DeepSeek routes.
 *
 * @module @deepseek-ai/dsh-llm-deepseek/dynamic-model-fetcher
 */

import type { ModelModality } from '@deepseek-ai/dsh-llm'
import type { DeepSeekCatalogModel } from './adapter.ts'

/** Model information advertised by an OpenAI-compatible `/models` endpoint. */
export interface DeepSeekModelInfo {
  id: string
  name?: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  inputModalities?: ModelModality[]
  imagePixelBudget?: number
  imageMaxBytes?: number
  imageDetail?: 'auto' | 'low'
}

let cachedModelInfo: readonly DeepSeekCatalogModel[] = []

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function optionalModalities(value: unknown): ModelModality[] | undefined {
  if (!Array.isArray(value)) return undefined
  const modes = value.filter((mode): mode is ModelModality => mode === 'text' || mode === 'image')
  return modes.length === 0 ? undefined : [...new Set(modes)]
}

function optionalImageDetail(value: unknown): 'auto' | 'low' | undefined {
  return value === 'auto' || value === 'low' ? value : undefined
}

function parseModelInfo(id: string, value: unknown): DeepSeekModelInfo | undefined {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const wireId = optionalString(record.id) ?? id
  if (wireId.length === 0) return undefined
  const description = optionalString(record.description)
  const contextWindow = optionalPositiveInteger(record.context_window)
    ?? optionalPositiveInteger(record.max_context_length)
    ?? optionalPositiveInteger(record.contextWindow)
  const maxTokens = optionalPositiveInteger(record.max_tokens) ?? optionalPositiveInteger(record.maxTokens)
  const inputModalities = optionalModalities(record.input_modalities) ?? optionalModalities(record.inputModalities)
  const imagePixelBudget = optionalPositiveInteger(record.image_pixel_budget)
    ?? optionalPositiveInteger(record.imagePixelBudget)
  const imageMaxBytes = optionalPositiveInteger(record.image_max_bytes) ?? optionalPositiveInteger(record.imageMaxBytes)
  const imageDetail = optionalImageDetail(record.image_detail) ?? optionalImageDetail(record.imageDetail)
  return {
    id: wireId,
    name: optionalString(record.name) ?? wireId,
    ...description === undefined ? {} : { description },
    ...contextWindow === undefined ? {} : { contextWindow },
    ...maxTokens === undefined ? {} : { maxTokens },
    ...inputModalities === undefined ? {} : { inputModalities },
    ...imagePixelBudget === undefined ? {} : { imagePixelBudget },
    ...imageMaxBytes === undefined ? {} : { imageMaxBytes },
    ...imageDetail === undefined ? {} : { imageDetail },
  }
}

function parseModelsPayload(data: unknown): DeepSeekModelInfo[] {
  const record = asRecord(data)
  if (record === undefined) return []
  if (Array.isArray(record.data)) {
    return record.data
      .map((model, index) => parseModelInfo(String(index), model))
      .filter((model): model is DeepSeekModelInfo => model !== undefined)
  }
  return Object.entries(record)
    .map(([id, model]) => parseModelInfo(id, model))
    .filter((model): model is DeepSeekModelInfo => model !== undefined)
}

function toCatalogModel(model: DeepSeekModelInfo): DeepSeekCatalogModel {
  return {
    id: model.id,
    name: model.name ?? model.id,
    ...model.description === undefined ? {} : { description: model.description },
    ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
    ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
    ...model.inputModalities === undefined ? {} : { inputModalities: model.inputModalities },
    ...model.imagePixelBudget === undefined ? {} : { imagePixelBudget: model.imagePixelBudget },
    ...model.imageMaxBytes === undefined ? {} : { imageMaxBytes: model.imageMaxBytes },
    ...model.imageDetail === undefined ? {} : { imageDetail: model.imageDetail },
  }
}

/**
 * Fetch available models from an OpenAI-compatible `/models` endpoint.
 * @param baseURL - endpoint base; `/models` is appended.
 * @param apiKey - bearer token used only for this discovery request.
 * @returns parsed model metadata accepted by the harness catalog.
 */
export async function fetchAvailableModels(baseURL: string, apiKey: string): Promise<DeepSeekModelInfo[]> {
  const response = await fetch(`${baseURL}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) throw new Error(`DeepSeek model discovery failed with HTTP ${response.status}`)
  return parseModelsPayload(await response.json())
}

/**
 * Refresh and retain process-local dynamic model metadata.
 * @param baseURL - endpoint base; `/models` is appended.
 * @param apiKey - bearer token used only for this discovery request.
 * @returns catalog entries currently cached for this process.
 */
export async function refreshCachedModelInfo(baseURL: string, apiKey: string): Promise<readonly DeepSeekCatalogModel[]> {
  cachedModelInfo = (await fetchAvailableModels(baseURL, apiKey)).map(toCatalogModel)
  return cachedModelInfo
}

/**
 * Latest process-local dynamic model metadata.
 * @returns catalog entries from the most recent successful discovery request.
 */
export function getCachedModelInfo(): readonly DeepSeekCatalogModel[] {
  return cachedModelInfo
}
