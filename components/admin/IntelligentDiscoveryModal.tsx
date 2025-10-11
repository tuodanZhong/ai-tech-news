'use client'

import { useState } from 'react'
import type { DiscoveredRSSFeed, RSSDiscoveryResult } from '@/types/sources'

interface IntelligentDiscoveryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function IntelligentDiscoveryModal({
  isOpen,
  onClose,
  onSuccess
}: IntelligentDiscoveryModalProps) {
  const [url, setUrl] = useState('')
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<RSSDiscoveryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedFeeds, setSelectedFeeds] = useState<Set<string>>(new Set())

  // 重置状态
  const resetState = () => {
    setUrl('')
    setResult(null)
    setError(null)
    setSelectedFeeds(new Set())
    setIsDiscovering(false)
    setIsSaving(false)
  }

  // 关闭模态框
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 执行智能发现
  const handleDiscover = async () => {
    if (!url.trim()) {
      setError('请输入网站 URL')
      return
    }

    setIsDiscovering(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/sources/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || '发现失败')
      }

      setResult(data.data)

      // 默认选中所有推荐的源
      const recommended = new Set<string>(
        data.data.recommended.map((feed: DiscoveredRSSFeed) => feed.url)
      )
      setSelectedFeeds(recommended)

    } catch (err) {
      setError(err instanceof Error ? err.message : '发现失败,请检查 URL 是否正确')
    } finally {
      setIsDiscovering(false)
    }
  }

  // 保存选中的源
  const handleSave = async () => {
    if (!result || selectedFeeds.size === 0) {
      setError('请至少选择一个 RSS 源')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const feedsToSave = result.recommended
        .filter(feed => selectedFeeds.has(feed.url))
        .map(feed => ({
          url: feed.url,
          name: feed.name,
          category: feed.category,
          feedType: feed.feedType,
          websiteUrl: result.websiteUrl,
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

      // 成功提示
      alert(`成功保存 ${data.data.saved} 个 RSS 源!`)

      // 通知父组件刷新列表
      onSuccess()

      // 关闭模态框
      handleClose()

    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
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

  // 获取推荐度颜色
  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strongly_recommend':
        return 'text-green-600'
      case 'recommend':
        return 'text-blue-600'
      case 'caution':
        return 'text-yellow-600'
      case 'not_recommend':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  // 获取推荐度文本
  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'strongly_recommend':
        return '强烈推荐'
      case 'recommend':
        return '推荐'
      case 'caution':
        return '谨慎'
      case 'not_recommend':
        return '不推荐'
      default:
        return '未知'
    }
  }

  // 获取源类型文本
  const getFeedTypeText = (feedType: string) => {
    switch (feedType) {
      case 'specific':
        return '专门板块'
      case 'general':
        return '全站内容'
      case 'unknown':
        return '未知'
      default:
        return feedType
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 标题 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">🔍 智能 RSS 发现</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={isDiscovering || isSaving}
            >
              ×
            </button>
          </div>

          {/* URL 输入 */}
          {!result && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                网站 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isDiscovering}
                  onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                />
                <button
                  onClick={handleDiscover}
                  disabled={isDiscovering || !url.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isDiscovering ? '发现中...' : '开始发现'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                输入网站首页地址,系统将自动发现并分析所有 RSS 源
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* 发现中状态 */}
          {isDiscovering && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">正在智能分析网站的 RSS 源...</p>
              <p className="text-sm text-gray-500 mt-2">这可能需要几分钟时间</p>
            </div>
          )}

          {/* 发现结果 */}
          {result && (
            <div>
              {/* 网站信息 */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">{result.websiteName}</h3>
                <p className="text-sm text-gray-600 mb-2">{result.websiteUrl}</p>
                <p className="text-sm text-gray-700">{result.reason}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="text-gray-600">
                    发现源: <strong>{result.feeds.length}</strong>
                  </span>
                  <span className="text-green-600">
                    推荐: <strong>{result.recommended.length}</strong>
                  </span>
                  <span className="text-gray-500">
                    忽略: <strong>{result.ignored.length}</strong>
                  </span>
                </div>
              </div>

              {/* 推荐的源 */}
              {result.recommended.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3">✅ 推荐的 RSS 源</h4>
                  <div className="space-y-3">
                    {result.recommended.map((feed) => (
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
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-gray-800">{feed.name}</h5>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                {getFeedTypeText(feed.feedType)}
                              </span>
                              <span className={`text-xs font-medium ${getRecommendationColor(feed.recommendation)}`}>
                                {getRecommendationText(feed.recommendation)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{feed.url}</p>
                            <p className="text-sm text-gray-700 mb-2">{feed.reasoning}</p>
                            <div className="flex gap-4 text-xs text-gray-600">
                              <span>科技相关性: {feed.techRelevance}%</span>
                              <span>AI 相关性: {feed.aiRelevance}%</span>
                              <span>置信度: {feed.confidence}%</span>
                            </div>
                            {feed.sampleTitles.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                  查看示例文章 ({feed.sampleTitles.length} 篇)
                                </summary>
                                <ul className="mt-2 ml-4 space-y-1">
                                  {feed.sampleTitles.map((title, idx) => (
                                    <li key={idx} className="text-xs text-gray-600">• {title}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 被忽略的源 */}
              {result.ignored.length > 0 && (
                <details className="mb-6">
                  <summary className="font-semibold text-gray-600 cursor-pointer hover:text-gray-800">
                    ⚪ 忽略的 RSS 源 ({result.ignored.length} 个)
                  </summary>
                  <div className="mt-3 space-y-2">
                    {result.ignored.map((feed) => (
                      <div key={feed.url} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="text-sm font-medium text-gray-700">{feed.name}</h5>
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                            {getFeedTypeText(feed.feedType)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{feed.url}</p>
                        <p className="text-xs text-gray-600 mt-1">{feed.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  onClick={() => {
                    setResult(null)
                    setError(null)
                    setSelectedFeeds(new Set())
                  }}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isSaving}
                >
                  重新发现
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedFeeds.size === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? '保存中...' : `保存选中的源 (${selectedFeeds.size})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
