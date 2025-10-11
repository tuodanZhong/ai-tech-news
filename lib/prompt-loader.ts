/**
 * 提示词加载器
 * 从数据库加载提示词配置，并在运行时替换模板变量
 */

import { prisma } from './db'

// 提示词配置接口
export interface PromptConfig {
  key: string
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate: string
  outputFormat: string
  temperature?: number
  useJsonMode: boolean
  version: number
}

// 内存缓存
const promptCache = new Map<string, PromptConfig>()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

/**
 * 从数据库加载提示词配置
 * @param key 提示词唯一标识 (rss_analysis, content_filter, trending_analysis)
 * @returns 提示词配置对象
 */
export async function loadPrompt(key: string): Promise<PromptConfig | null> {
  try {
    // 检查缓存
    const cached = promptCache.get(key)
    if (cached) {
      return cached
    }

    // 从数据库加载
    const config = await prisma.promptConfig.findUnique({
      where: { key, isActive: true }
    })

    if (!config) {
      console.warn(`[PromptLoader] 提示词配置未找到: ${key}`)
      return null
    }

    const promptConfig: PromptConfig = {
      key: config.key,
      name: config.name,
      description: config.description,
      systemPrompt: config.systemPrompt,
      userPromptTemplate: config.userPromptTemplate,
      outputFormat: config.outputFormat,
      temperature: config.temperature || undefined,
      useJsonMode: config.useJsonMode,
      version: config.version
    }

    // 存入缓存
    promptCache.set(key, promptConfig)

    // 设置缓存过期
    setTimeout(() => {
      promptCache.delete(key)
    }, CACHE_TTL)

    console.log(`[PromptLoader] 加载提示词: ${key} (v${config.version})`)
    return promptConfig

  } catch (error) {
    console.error(`[PromptLoader] 加载提示词失败: ${key}`, error)
    return null
  }
}

/**
 * 渲染提示词模板，替换变量占位符
 * 注意：变量不会被转义，直接替换 {{variable}} 为对应值
 *
 * @param template 包含 {{variable}} 占位符的模板字符串
 * @param variables 变量键值对
 * @returns 渲染后的字符串
 *
 * @example
 * renderPrompt('Hello {{name}}', { name: 'World' })
 * // => 'Hello World'
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | number>
): string {
  let rendered = template

  // 替换所有 {{variable}} 占位符
  // 使用简单的正则替换，不进行任何转义
  Object.keys(variables).forEach(key => {
    const value = String(variables[key])
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(placeholder, value)
  })

  return rendered
}

/**
 * 清除提示词缓存
 * @param key 指定清除的提示词，不传则清除全部
 */
export function clearPromptCache(key?: string) {
  if (key) {
    promptCache.delete(key)
    console.log(`[PromptLoader] 清除缓存: ${key}`)
  } else {
    promptCache.clear()
    console.log('[PromptLoader] 清除全部缓存')
  }
}
