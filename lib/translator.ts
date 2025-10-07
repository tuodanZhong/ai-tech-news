import * as tencentcloud from 'tencentcloud-sdk-nodejs-tmt'

// 腾讯云翻译客户端实例
let tmtClient: any = null

/**
 * 初始化腾讯云翻译客户端
 */
function getTencentClient() {
  if (!tmtClient) {
    const TmtClient = tencentcloud.tmt.v20180321.Client

    const clientConfig = {
      credential: {
        secretId: process.env.TENCENT_SECRET_ID || '',
        secretKey: process.env.TENCENT_SECRET_KEY || '',
      },
      region: 'ap-guangzhou', // 广州地域
      profile: {
        httpProfile: {
          endpoint: 'tmt.tencentcloudapi.com',
        },
      },
    }

    tmtClient = new TmtClient(clientConfig)
  }

  return tmtClient
}

/**
 * 检测文本是否为中文
 */
export function isChinese(text: string): boolean {
  if (!text) return false
  // 检测是否包含中文字符（包括简体和繁体）
  const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const totalCharCount = text.replace(/\s/g, '').length

  // 如果中文字符占比超过30%，认为是中文文本
  return totalCharCount > 0 && (chineseCharCount / totalCharCount) > 0.3
}

/**
 * 使用腾讯云翻译API翻译文本到中文
 * @returns 翻译结果，如果翻译失败则抛出错误
 */
export async function translateToChinese(text: string): Promise<string> {
  if (!text || text.trim() === '') {
    return text
  }

  // 如果已经是中文，直接返回
  if (isChinese(text)) {
    return text
  }

  // 检查是否配置了腾讯云密钥
  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    throw new Error('腾讯云翻译API未配置')
  }

  const client = getTencentClient()

  const params = {
    SourceText: text,
    Source: 'auto', // 自动检测源语言
    Target: 'zh',   // 目标语言：简体中文
    ProjectId: 0,   // 项目ID，默认为0
  }

  const response = await client.TextTranslate(params)

  if (!response.TargetText) {
    throw new Error('翻译API返回空结果')
  }

  return response.TargetText
}

/**
 * 批量翻译文本（带延迟避免被限流）
 */
export async function translateBatch(texts: string[]): Promise<string[]> {
  const results: string[] = []

  for (const text of texts) {
    const translated = await translateToChinese(text)
    results.push(translated)
    // 添加小延迟避免 API 限流
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}
