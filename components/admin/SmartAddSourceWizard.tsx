'use client'

import { useState } from 'react'
import type { DiscoveredRSSFeed, RSSDiscoveryResult } from '@/types/sources'

interface SmartAddSourceWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type WizardStep =
  | 'input'           // 输入 URL
  | 'detecting'       // 智能检测中
  | 'rss-selection'   // RSS 源选择
  | 'web-config'      // 网页爬虫配置
  | 'testing'         // 测试中
  | 'web-preview'     // 网页采集预览
  | 'web-advanced'    // 网页高级配置
  | 'complete'        // 完成

interface DetectionResult {
  type: 'rss-feed' | 'website-with-rss' | 'website-no-rss'
  rssUrl?: string
  discoveryResult?: RSSDiscoveryResult
  websiteUrl?: string
}

export default function SmartAddSourceWizard({
  isOpen,
  onClose,
  onSuccess
}: SmartAddSourceWizardProps) {
  const [step, setStep] = useState<WizardStep>('input')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)
  const [selectedFeeds, setSelectedFeeds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // 表单数据（手动添加）
  const [manualFormData, setManualFormData] = useState({
    name: '',
    category: ''
  })

  // 网页采集测试结果
  const [webTestResult, setWebTestResult] = useState<any>(null)

  // 网页高级配置
  const [webScrapeConfig, setWebScrapeConfig] = useState({
    excludePatterns: [] as string[],
    includePatterns: [] as string[]
  })

  // 重置状态
  const resetState = () => {
    setStep('input')
    setUrl('')
    setError(null)
    setDetectionResult(null)
    setSelectedFeeds(new Set())
    setManualFormData({ name: '', category: '' })
    setIsSaving(false)
    setIsTesting(false)
    setWebTestResult(null)
    setWebScrapeConfig({ excludePatterns: [], includePatterns: [] })
  }

  // 关闭向导
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 智能检测 URL
  const handleSmartDetect = async () => {
    if (!url.trim()) {
      setError('请输入 URL')
      return
    }

    setStep('detecting')
    setError(null)

    try {
      const urlObj = new URL(url.trim())

      // 步骤 1: 快速检测 URL 类型
      console.log('[向导] 开始智能检测:', url)

      // 检查是否是明确的 RSS URL
      const isRSSUrl =
        url.includes('/feed') ||
        url.includes('/rss') ||
        url.includes('/atom') ||
        url.endsWith('.xml') ||
        url.includes('feed.xml') ||
        url.includes('rss.xml')

      if (isRSSUrl) {
        // 直接是 RSS URL，进入手动添加流程
        console.log('[向导] 检测到 RSS URL，进入手动添加')
        setDetectionResult({
          type: 'rss-feed',
          rssUrl: url.trim()
        })
        setStep('web-config') // 复用这个步骤作为手动填写信息
        return
      }

      // 步骤 2: 是网站 URL，执行智能发现
      console.log('[向导] 检测到网站 URL，开始智能发现...')

      const response = await fetch('/api/sources/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || '智能发现失败')
      }

      // 步骤 3: 分析发现结果
      if (data.data.recommended.length > 0) {
        // 发现了推荐的 RSS 源
        console.log(`[向导] 发现 ${data.data.recommended.length} 个推荐的 RSS 源`)
        setDetectionResult({
          type: 'website-with-rss',
          discoveryResult: data.data,
          websiteUrl: url.trim()
        })

        // 默认不选中,让用户自主选择
        setSelectedFeeds(new Set())

        setStep('rss-selection')
      } else {
        // 没有发现 RSS 源，使用网页爬虫
        console.log('[向导] 未发现 RSS 源，将使用网页爬虫')
        setDetectionResult({
          type: 'website-no-rss',
          websiteUrl: url.trim()
        })
        setStep('web-config')
      }

    } catch (err) {
      console.error('[向导] 检测失败:', err)
      setError(err instanceof Error ? err.message : '检测失败，请检查 URL 是否正确')
      setStep('input')
    }
  }

  // 保存选中的 RSS 源
  const handleSaveRSSFeeds = async () => {
    if (!detectionResult?.discoveryResult || selectedFeeds.size === 0) {
      setError('请至少选择一个 RSS 源')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const feedsToSave = detectionResult.discoveryResult.recommended
        .filter(feed => selectedFeeds.has(feed.url))
        .map(feed => ({
          url: feed.url,
          name: feed.name,
          category: feed.category,
          feedType: feed.feedType,
          websiteUrl: detectionResult.discoveryResult!.websiteUrl,
          aiAnalysis: JSON.stringify({
            techRelevance: feed.techRelevance,
            aiRelevance: feed.aiRelevance,
            confidence: feed.confidence,
            recommendation: feed.recommendation,
            reasoning: feed.reasoning,
            sampleTitles: feed.sampleTitles
          })
        }))

      const response = await fetch('/api/sources/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feeds: feedsToSave }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '保存失败')
      }

      console.log(`[向导] 成功保存 ${data.data.saved} 个 RSS 源`)

      // 如果有部分失败（有错误但也有成功的），显示警告
      if (data.data.errors && data.data.errors.length > 0 && data.data.saved > 0) {
        const duplicateCount = data.data.errors.filter(
          (err: any) => err.error === 'RSS source already exists'
        ).length

        if (duplicateCount > 0) {
          setError(`⚠️ ${duplicateCount} 个源已存在被跳过，成功保存 ${data.data.saved} 个新源`)
        }
      }

      setStep('complete')

      // 2 秒后自动关闭并刷新
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 测试网页采集
  const handleTestWebScrape = async () => {
    if (!manualFormData.name.trim() || !manualFormData.category.trim()) {
      setError('请填写名称和分类')
      return
    }

    setIsTesting(true)
    setError(null)
    setStep('testing')

    try {
      // 先创建临时源进行测试
      const tempSource = {
        name: manualFormData.name,
        url: detectionResult?.websiteUrl || url,
        category: manualFormData.category,
        type: 'web' as const,
        scrapeConfig: webScrapeConfig.excludePatterns.length > 0 || webScrapeConfig.includePatterns.length > 0
          ? webScrapeConfig
          : undefined
      }

      const createResponse = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tempSource)
      })

      const createData = await createResponse.json()

      if (!createResponse.ok || !createData.success) {
        throw new Error(createData.error || '创建源失败')
      }

      const sourceId = createData.source.id

      // 测试采集
      const testResponse = await fetch(`/api/admin/sources/${sourceId}/test`, {
        method: 'POST'
      })

      const testData = await testResponse.json()

      if (!testResponse.ok || !testData.success) {
        // 测试失败,删除临时源
        await fetch(`/api/admin/sources/${sourceId}`, { method: 'DELETE' })
        throw new Error(testData.error || '测试采集失败')
      }

      console.log('[向导] 网页采集测试成功:', testData)

      setWebTestResult({
        sourceId,
        ...testData
      })
      setStep('web-preview')

    } catch (err) {
      setError(err instanceof Error ? err.message : '测试失败')
      setStep('web-config')
    } finally {
      setIsTesting(false)
    }
  }

  // 保存单个 RSS 源或网页源
  const handleSaveManualSource = async () => {
    if (!manualFormData.name.trim() || !manualFormData.category.trim()) {
      setError('请填写名称和分类')
      return
    }

    // 如果是网页类型,先测试采集
    if (detectionResult?.type === 'website-no-rss') {
      await handleTestWebScrape()
      return
    }

    // RSS 类型直接保存
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: manualFormData.name,
          url: detectionResult?.rssUrl || url,
          category: manualFormData.category,
          type: 'rss'
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '保存失败')
      }

      console.log(`[向导] 成功添加源: ${manualFormData.name}`)

      setStep('complete')

      // 2 秒后自动关闭并刷新
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 确认并保存网页源
  const handleConfirmWebSource = async () => {
    setStep('complete')

    // 2 秒后自动关闭并刷新
    setTimeout(() => {
      onSuccess()
      handleClose()
    }, 2000)
  }

  // 取消并删除测试源
  const handleCancelWebSource = async () => {
    if (webTestResult?.sourceId) {
      try {
        await fetch(`/api/admin/sources/${webTestResult.sourceId}`, {
          method: 'DELETE'
        })
      } catch (err) {
        console.error('[向导] 删除测试源失败:', err)
      }
    }
    setWebTestResult(null)
    setStep('web-config')
  }

  // 进入高级配置
  const handleAdvancedConfig = () => {
    setStep('web-advanced')
  }

  // 切换选中状态
  const toggleFeed = (feedUrl: string) => {
    const newSelected = new Set(selectedFeeds)
    if (newSelected.has(feedUrl)) {
      newSelected.delete(feedUrl)
    } else {
      newSelected.add(feedUrl)
    }
    setSelectedFeeds(newSelected)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 标题 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {step === 'input' && '➕ 智能添加信息源'}
              {step === 'detecting' && '🔍 智能检测中...'}
              {step === 'rss-selection' && '📡 选择 RSS 源'}
              {step === 'web-config' && (detectionResult?.type === 'rss-feed' ? '📝 填写信息' : '🌐 配置网页采集')}
              {step === 'testing' && '🧪 测试采集中...'}
              {step === 'web-preview' && '👀 预览采集结果'}
              {step === 'web-advanced' && '⚙️ 高级配置'}
              {step === 'complete' && '✅ 添加成功'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={step === 'detecting' || step === 'testing' || isSaving}
            >
              ×
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* 步骤 1: URL 输入 */}
          {step === 'input' && (
            <div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  网站或 RSS 地址
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://techcrunch.com 或 https://techcrunch.com/feed"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleSmartDetect()}
                    autoFocus
                  />
                  <button
                    onClick={handleSmartDetect}
                    disabled={!url.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    下一步
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-gray-600">
                    💡 <strong>智能识别:</strong>
                  </p>
                  <ul className="text-sm text-gray-600 ml-4 space-y-1">
                    <li>• 输入网站首页 (如 techcrunch.com) → 自动发现所有 RSS 源</li>
                    <li>• 输入 RSS 地址 (如 techcrunch.com/feed) → 直接添加</li>
                    <li>• 没有 RSS 源？→ 自动使用网页爬虫采集</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 步骤 2: 智能检测中 */}
          {step === 'detecting' && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">正在智能分析...</p>
              <p className="text-sm text-gray-500 mt-2">
                检测 URL 类型 → 发现 RSS 源 → AI 智能分析
              </p>
            </div>
          )}

          {/* 步骤 3: RSS 源选择 */}
          {step === 'rss-selection' && detectionResult?.discoveryResult && (
            <div>
              {/* 网站信息 */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🎉</span>
                  <h3 className="font-semibold text-green-900">
                    发现了 {detectionResult.discoveryResult.recommended.length} 个优质 RSS 源!
                  </h3>
                </div>
                <p className="text-sm text-green-700">
                  {detectionResult.discoveryResult.reason}
                </p>
              </div>

              {/* 推荐的源列表 */}
              <div className="mb-6 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {detectionResult.discoveryResult.recommended.map((feed) => (
                    <div
                      key={feed.url}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedFeeds.has(feed.url)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleFeed(feed.url)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedFeeds.has(feed.url)}
                          onChange={() => toggleFeed(feed.url)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-gray-800">{feed.name}</h5>
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                              {feed.feedType === 'specific' ? '专门板块' : '全站内容'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{feed.reasoning}</p>
                          <div className="flex gap-4 text-xs text-gray-600 mb-2">
                            <span>科技相关性: {feed.techRelevance}%</span>
                            <span>AI 相关性: {feed.aiRelevance}%</span>
                          </div>
                          {feed.sampleTitles.length > 0 && (
                            <details className="mt-3 group">
                              <summary className="cursor-pointer list-none">
                                <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-purple-100 transition-all">
                                  <span className="text-sm font-medium text-blue-700">📰 查看最近文章</span>
                                  <span className="text-xs text-blue-600 bg-white px-2 py-0.5 rounded-full">{feed.sampleTitles.length} 篇</span>
                                  <svg className="w-4 h-4 text-blue-600 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </summary>
                              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                                <ul className="space-y-2">
                                  {feed.sampleTitles.map((title, idx) => (
                                    <li key={idx} className="text-xs text-gray-700 flex items-start gap-2">
                                      <span className="text-gray-400 flex-shrink-0 font-medium">{idx + 1}.</span>
                                      <span>{title}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  onClick={() => {
                    // 切换到网页爬虫模式
                    setDetectionResult({
                      type: 'website-no-rss',
                      websiteUrl: detectionResult?.discoveryResult?.websiteUrl || detectionResult?.websiteUrl || url
                    })
                    setStep('web-config')
                  }}
                  className="px-4 py-2 text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-2"
                  disabled={isSaving}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>这些都不符合，改用网页爬虫</span>
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('input')}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    disabled={isSaving}
                  >
                    返回
                  </button>
                  <button
                    onClick={handleSaveRSSFeeds}
                    disabled={isSaving || selectedFeeds.size === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isSaving ? '保存中...' : `保存选中的源 (${selectedFeeds.size})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤 4: 网页配置或手动填写 */}
          {step === 'web-config' && (
            <div>
              {detectionResult?.type === 'website-no-rss' ? (
                // 网页爬虫模式
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🌐</span>
                    <h3 className="font-semibold text-yellow-900">
                      未发现 RSS 源，将使用网页爬虫采集
                    </h3>
                  </div>
                  <p className="text-sm text-yellow-700">
                    系统会自动从网页中提取文章链接。保存后请务必测试采集效果。
                  </p>
                </div>
              ) : (
                // RSS 直接添加模式
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📡</span>
                    <h3 className="font-semibold text-blue-900">检测到 RSS 地址</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-2">
                    URL: <code className="bg-white px-2 py-1 rounded">{detectionResult?.rssUrl}</code>
                  </p>
                  <p className="text-sm text-blue-700">
                    请填写名称和分类信息
                  </p>
                </div>
              )}

              {/* 手动填写表单 */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualFormData.name}
                    onChange={(e) => setManualFormData({ ...manualFormData, name: e.target.value })}
                    placeholder="例如: TechCrunch AI"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分类 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualFormData.category}
                    onChange={(e) => setManualFormData({ ...manualFormData, category: e.target.value })}
                    placeholder="例如: AI, 科技资讯, 产品评测"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  onClick={() => setStep('input')}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isSaving}
                >
                  返回
                </button>
                <button
                  onClick={handleSaveManualSource}
                  disabled={isSaving || !manualFormData.name.trim() || !manualFormData.category.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSaving ? '保存中...' : '保存并测试'}
                </button>
              </div>
            </div>
          )}

          {/* 步骤 5: 测试采集中 */}
          {step === 'testing' && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">正在测试网页采集...</p>
              <p className="text-sm text-gray-500 mt-2">
                这可能需要几秒钟,请稍候...
              </p>
            </div>
          )}

          {/* 步骤 6: 网页采集预览 */}
          {step === 'web-preview' && webTestResult && (
            <div>
              {/* 测试结果概览 */}
              <div className={`mb-6 p-4 ${webTestResult.data?.articles?.length > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{webTestResult.data?.articles?.length > 0 ? '✅' : '⚠️'}</span>
                  <h3 className={`font-semibold ${webTestResult.data?.articles?.length > 0 ? 'text-green-900' : 'text-yellow-900'}`}>
                    {webTestResult.data?.articles?.length > 0
                      ? `成功采集到 ${webTestResult.data.articles.length} 篇文章`
                      : '未采集到文章'}
                  </h3>
                </div>
                {webTestResult.data?.articles?.length === 0 && (
                  <p className="text-sm text-yellow-700">
                    建议使用高级配置调整采集规则,或返回选择其他方式
                  </p>
                )}
              </div>

              {/* 文章列表 */}
              {webTestResult.data?.articles && webTestResult.data.articles.length > 0 && (
                <div className="mb-6 max-h-96 overflow-y-auto">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">采集到的文章列表:</h4>
                  <div className="space-y-2">
                    {webTestResult.data.articles.map((article: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-gray-400 flex-shrink-0 font-medium mt-1">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">{article.title}</h5>
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {article.link}
                            </a>
                            {article.pubDate && (
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(article.pubDate).toLocaleString('zh-CN')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelWebSource}
                    className="px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                  >
                    取消并删除
                  </button>
                  <button
                    onClick={handleAdvancedConfig}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    高级配置
                  </button>
                </div>
                <button
                  onClick={handleConfirmWebSource}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  确认并保存
                </button>
              </div>
            </div>
          )}

          {/* 步骤 7: 高级配置 */}
          {step === 'web-advanced' && (
            <div>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">⚙️ 高级过滤配置</h3>
                <p className="text-sm text-blue-700">
                  通过配置包含和排除模式,可以更精确地控制采集的文章范围
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    排除模式 (Exclude Patterns)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    包含这些关键词的链接将被过滤掉,每行一个模式
                  </p>
                  <textarea
                    value={webScrapeConfig.excludePatterns.join('\n')}
                    onChange={(e) => setWebScrapeConfig({
                      ...webScrapeConfig,
                      excludePatterns: e.target.value.split('\n').filter(p => p.trim())
                    })}
                    placeholder="/tag/&#10;/author/&#10;/page/"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    包含模式 (Include Patterns)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    只保留包含这些关键词的链接,每行一个模式(留空表示不限制)
                  </p>
                  <textarea
                    value={webScrapeConfig.includePatterns.join('\n')}
                    onChange={(e) => setWebScrapeConfig({
                      ...webScrapeConfig,
                      includePatterns: e.target.value.split('\n').filter(p => p.trim())
                    })}
                    placeholder="/news/&#10;/articles/"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={5}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  onClick={() => setStep('web-preview')}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  返回预览
                </button>
                <button
                  onClick={() => {
                    // 重新测试采集
                    handleTestWebScrape()
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  应用并重新测试
                </button>
              </div>
            </div>
          )}

          {/* 步骤 8: 完成 */}
          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-green-600 mb-2">添加成功!</h3>
              <p className="text-gray-600">正在刷新列表...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
