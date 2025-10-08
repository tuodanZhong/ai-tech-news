'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  titleOriginal: string | null
  description: string | null
  descriptionOriginal: string | null
  link: string
  pubDate: string
  source: string
  category: string
  imageUrl: string | null
  isTranslated: boolean
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('all')
  const [search, setSearch] = useState('')
  const [sources, setSources] = useState<string[]>(['all'])
  const [lastFetchTime, setLastFetchTime] = useState<string>('')
  const [inputPage, setInputPage] = useState<string>('1')
  const [hotTopics48h, setHotTopics48h] = useState<any[]>([])
  const [hotTopics24h, setHotTopics24h] = useState<any[]>([])
  const [hotTopics48hUpdatedAt, setHotTopics48hUpdatedAt] = useState<string>('')
  const [hotTopics24hUpdatedAt, setHotTopics24hUpdatedAt] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [mobileHotTopicTab, setMobileHotTopicTab] = useState<'48h' | '24h'>('48h')
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 获取所有信息源和热点话题
  useEffect(() => {
    fetchSources()
    fetchHotTopics()
    fetchLastFetchTime()
  }, [])

  useEffect(() => {
    fetchArticles()
    setInputPage(pagination.page.toString())
  }, [source, pagination.page])

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/sources')
      const data = await res.json()

      if (data.sources) {
        // 添加 "all" 选项，然后添加所有信息源
        const sourceNames = ['all', ...data.sources.map((s: any) => s.name)]
        setSources(sourceNames)
      }
    } catch (error) {
      console.error('获取信息源失败:', error)
    }
  }

  const fetchLastFetchTime = async () => {
    try {
      const res = await fetch('/api/last-fetch-time')
      const data = await res.json()
      if (data.success && data.lastFetchTime) {
        setLastFetchTime(data.lastFetchTime)
      }
    } catch (error) {
      console.error('获取最后采集时间失败:', error)
    }
  }

  const fetchHotTopics = async (forceRefresh = false) => {
    try {
      const refreshParam = forceRefresh ? '?refresh=true' : ''
      const [res48h, res24h] = await Promise.all([
        fetch(`/api/hot-topics${refreshParam}`),
        fetch(`/api/hot-topics-24h${refreshParam}`)
      ])

      const data48h = await res48h.json()
      const data24h = await res24h.json()

      if (data48h.success && data48h.topics) {
        setHotTopics48h(data48h.topics)
        if (data48h.updatedAt) {
          setHotTopics48hUpdatedAt(data48h.updatedAt)
        }
      }

      if (data24h.success && data24h.topics) {
        setHotTopics24h(data24h.topics)
        if (data24h.updatedAt) {
          setHotTopics24hUpdatedAt(data24h.updatedAt)
        }
      }
    } catch (error) {
      console.error('获取热点话题失败:', error)
    }
  }

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (source !== 'all') params.append('source', source)
      if (search) params.append('search', search)

      const res = await fetch(`/api/articles?${params}`)
      const data = await res.json()

      setArticles(data.articles || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error('获取文章失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchArticles()
  }


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const formatUpdateTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const handleTopicClick = (topic: any) => {
    setSelectedTopic(topic)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setTimeout(() => setSelectedTopic(null), 300)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 bg-gradient-to-b from-slate-700 to-slate-600 border-b-4 border-slate-800 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              科技资讯
            </h1>
            <div className="flex gap-2 sm:gap-3 items-center">
              {lastFetchTime ? (
                <div className="text-white text-xs sm:text-sm text-right">
                  <div className="sm:hidden text-[10px] text-slate-200">上次更新</div>
                  <span className="hidden sm:inline">上次更新: </span>
                  <span className="sm:hidden">{formatUpdateTime(lastFetchTime).split(' ')[1]}</span>
                  <span className="hidden sm:inline">{formatUpdateTime(lastFetchTime)}</span>
                </div>
              ) : (
                <span className="text-white text-xs sm:text-sm">
                  {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16"></div>

      <main className="max-w-full mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* 左侧主内容区 */}
          <div className="flex-1 min-w-0">

        {/* 移动端热点话题区域 - 放在顶部 */}
        <div className="lg:hidden mb-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
            {/* 标签页切换 */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setMobileHotTopicTab('48h')}
                className={`flex-1 px-4 py-3 text-sm font-bold transition-colors ${
                  mobileHotTopicTab === '48h'
                    ? 'bg-slate-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                48小时热点
              </button>
              <button
                onClick={() => setMobileHotTopicTab('24h')}
                className={`flex-1 px-4 py-3 text-sm font-bold transition-colors ${
                  mobileHotTopicTab === '24h'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                24小时热点
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-4">
              {mobileHotTopicTab === '48h' && (
                <>
                  {hotTopics48hUpdatedAt && (
                    <p className="text-xs text-gray-500 mb-3">
                      更新于: {formatUpdateTime(hotTopics48hUpdatedAt)}
                    </p>
                  )}
                  <div className="space-y-4">
                    {hotTopics48h.length === 0 ? (
                      <div className="text-xs text-gray-500 text-center py-4">
                        加载中...
                      </div>
                    ) : (
                      hotTopics48h.slice(0, 10).map((topic, index) => (
                        <button
                          key={topic.id}
                          onClick={() => handleTopicClick(topic)}
                          className={`w-full text-left pb-4 hover:bg-slate-50 -mx-4 px-4 rounded transition-colors ${index !== Math.min(hotTopics48h.length, 10) - 1 ? 'border-b border-gray-200' : ''}`}
                        >
                          <h4 className="font-medium text-gray-900 hover:text-slate-600 leading-snug mb-2 text-sm transition-colors">
                            {topic.title}
                          </h4>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{topic.articles[0]?.source}</span>
                              <span>•</span>
                              <span className="text-orange-600 font-medium">{topic.discussionCount} 讨论</span>
                            </div>
                            {topic.sources.length > 1 && (
                              <div className="text-gray-400">
                                相关: {topic.sources.slice(1, 4).join(', ')}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}

              {mobileHotTopicTab === '24h' && (
                <>
                  {hotTopics24hUpdatedAt && (
                    <p className="text-xs text-gray-500 mb-3">
                      更新于: {formatUpdateTime(hotTopics24hUpdatedAt)}
                    </p>
                  )}
                  <div className="space-y-4">
                    {hotTopics24h.length === 0 ? (
                      <div className="text-xs text-gray-500 text-center py-4">
                        加载中...
                      </div>
                    ) : (
                      hotTopics24h.slice(0, 10).map((topic, index) => (
                        <button
                          key={topic.id}
                          onClick={() => handleTopicClick(topic)}
                          className={`w-full text-left pb-4 hover:bg-orange-50 -mx-4 px-4 rounded transition-colors ${index !== Math.min(hotTopics24h.length, 10) - 1 ? 'border-b border-gray-200' : ''}`}
                        >
                          <h4 className="font-medium text-gray-900 hover:text-orange-600 leading-snug mb-2 text-sm transition-colors">
                            {topic.title}
                          </h4>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-medium">{topic.articles[0]?.source}</span>
                              <span>•</span>
                              <span className="text-orange-600 font-medium">{topic.discussionCount} 讨论</span>
                            </div>
                            {topic.sources.length > 1 && (
                              <div className="text-gray-400">
                                相关: {topic.sources.slice(1, 4).join(', ')}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 sm:mb-6 bg-slate-50 border border-gray-200 p-3 sm:p-4 rounded">
          <form onSubmit={handleSearch} className="flex gap-2 mb-3 sm:mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索新闻标题..."
              className="flex-1 px-3 py-2 border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 rounded"
            />
            <button
              type="submit"
              className="px-3 sm:px-4 py-2 bg-slate-600 text-white text-xs sm:text-sm hover:bg-slate-700 transition-colors rounded shadow-sm whitespace-nowrap"
            >
              搜索
            </button>
          </form>

          <div className="flex gap-2 sm:gap-3 flex-wrap items-center text-xs">
            <span className="text-gray-600 font-semibold shrink-0">信息源:</span>
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => setSource(src)}
                className={`px-2 py-1 rounded transition-colors text-xs ${
                  source === src
                    ? 'bg-slate-600 text-white font-medium'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                {src === 'all' ? '全部' : src}
              </button>
            ))}
          </div>
        </div>

        {/* Articles */}
        {loading ? (
          <div className="py-8 text-gray-500 text-sm text-center">加载中...</div>
        ) : articles.length === 0 ? (
          <div className="py-8 text-gray-500 text-sm text-center">
            暂无资讯
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded">
            {articles.map((article, index) => (
              <article
                key={article.id}
                className={`py-3 sm:py-4 px-3 sm:px-4 hover:bg-slate-50 transition-colors ${
                  index !== articles.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
                    <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded shrink-0">{article.source}</span>
                    <div className="text-gray-400 text-xs sm:pt-1 sm:w-20 sm:text-right shrink-0">
                      {formatDate(article.pubDate)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base leading-snug">
                      <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-slate-600 hover:underline transition-colors">
                        {article.isTranslated ? article.title : article.titleOriginal || article.title}
                      </a>
                    </h2>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-4 sm:mt-6 bg-slate-50 border border-gray-200 p-3 sm:p-4 rounded">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-xs sm:text-sm">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-white border border-gray-300 text-slate-700 hover:bg-slate-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded shadow-sm"
              >
                ← 上一页
              </button>

              <span className="text-gray-600 font-medium text-center">
                第 {pagination.page} / {pagination.totalPages} 页 <span className="hidden sm:inline">(共 {pagination.total} 篇)</span>
              </span>

              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-white border border-gray-300 text-slate-700 hover:bg-slate-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded shadow-sm"
              >
                下一页 →
              </button>
            </div>
          </div>
        )}
          </div>

          {/* 48小时热点板块 */}
          <aside className="w-80 flex-shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
                <div className="bg-slate-600 px-4 py-3">
                  <h3 className="text-sm font-bold text-white mb-1">
                    48小时热点资讯
                  </h3>
                  {hotTopics48hUpdatedAt && (
                    <p className="text-xs text-slate-200">
                      更新于: {formatUpdateTime(hotTopics48hUpdatedAt)}
                    </p>
                  )}
                </div>

                <div className="p-4 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto">
                  {hotTopics48h.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-4">
                      加载中...
                    </div>
                  ) : (
                    hotTopics48h.map((topic, index) => (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicClick(topic)}
                        className={`w-full text-left pb-4 hover:bg-slate-50 -mx-4 px-4 rounded transition-colors ${index !== hotTopics48h.length - 1 ? 'border-b border-gray-200' : ''}`}
                      >
                        <h4 className="font-medium text-gray-900 hover:text-slate-600 leading-snug mb-2 text-sm transition-colors">
                          {topic.title}
                        </h4>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{topic.articles[0]?.source}</span>
                            <span>•</span>
                            <span className="text-orange-600 font-medium">{topic.discussionCount} 讨论</span>
                          </div>
                          {topic.sources.length > 1 && (
                            <div className="text-gray-400">
                              相关: {topic.sources.slice(1, 4).join(', ')}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* 24小时热点板块 */}
          <aside className="w-80 flex-shrink-0 hidden xl:block">
            <div className="sticky top-24">
              <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
                <div className="bg-orange-600 px-4 py-3">
                  <h3 className="text-sm font-bold text-white mb-1">
                    24小时热点资讯
                  </h3>
                  {hotTopics24hUpdatedAt && (
                    <p className="text-xs text-orange-100">
                      更新于: {formatUpdateTime(hotTopics24hUpdatedAt)}
                    </p>
                  )}
                </div>

                <div className="p-4 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto">
                  {hotTopics24h.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-4">
                      加载中...
                    </div>
                  ) : (
                    hotTopics24h.map((topic, index) => (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicClick(topic)}
                        className={`w-full text-left pb-4 hover:bg-orange-50 -mx-4 px-4 rounded transition-colors ${index !== hotTopics24h.length - 1 ? 'border-b border-gray-200' : ''}`}
                      >
                        <h4 className="font-medium text-gray-900 hover:text-orange-600 leading-snug mb-2 text-sm transition-colors">
                          {topic.title}
                        </h4>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-medium">{topic.articles[0]?.source}</span>
                            <span>•</span>
                            <span className="text-orange-600 font-medium">{topic.discussionCount} 讨论</span>
                          </div>
                          {topic.sources.length > 1 && (
                            <div className="text-gray-400">
                              相关: {topic.sources.slice(1, 4).join(', ')}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modal */}
      {showModal && selectedTopic && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-start">
              <div className="flex-1 pr-3 sm:pr-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <span className="text-xl sm:text-2xl">🔥</span>
                  <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2">
                    {selectedTopic.title}
                  </h3>
                </div>
                <div className="text-xs text-slate-200">
                  共 {selectedTopic.articles.length} 篇相关报道
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white hover:text-slate-200 text-2xl sm:text-3xl font-bold leading-none transition-colors flex-shrink-0"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-100px)] sm:max-h-[calc(80vh-100px)]">
              <div className="space-y-3">
                {selectedTopic.articles.map((article: any) => (
                  <div
                    key={article.id}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            {article.source}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(article.pubDate)}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 leading-snug mb-2">
                          {article.isTranslated ? article.title : article.titleOriginal || article.title}
                        </h4>
                      </div>
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap self-start"
                      >
                        查看原文 →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
