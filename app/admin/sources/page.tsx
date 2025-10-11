'use client'

import { useState, useEffect } from 'react'
import type { SourceType, TestStatus } from '@/lib/sources/types'
import SmartAddSourceWizard from '@/components/admin/SmartAddSourceWizard'
import AdminAuthGuard from '@/components/AdminAuthGuard'

interface Source {
  id: string
  name: string
  url: string
  category: string
  type: SourceType
  isActive: boolean
  isTested: boolean
  testStatus: TestStatus | null
  testResult: any
  lastTested: string | null
  lastFetched: string | null
  scrapeConfig: any
  createdAt: string
  updatedAt: string
}

export default function SourceManagementPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'tested' | 'untested'>('all')
  const [showSmartWizard, setShowSmartWizard] = useState(false)
  const [editingSource, setEditingSource] = useState<Source | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null)
  const [testResultModal, setTestResultModal] = useState<{
    show: boolean
    sourceName: string
    sourceId: string
    result: any
  }>({
    show: false,
    sourceName: '',
    sourceId: '',
    result: null
  })
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configFormData, setConfigFormData] = useState<{
    excludePatterns: string[]
    includePatterns: string[]
  }>({
    excludePatterns: [],
    includePatterns: []
  })

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    category: '',
    type: 'rss' as SourceType
  })

  // 加载信息源列表
  const loadSources = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? `?filter=${filter}` : ''
      const response = await fetch(`/api/admin/sources${params}`)
      const data = await response.json()
      if (data.success) {
        setSources(data.sources)
      }
    } catch (error) {
      console.error('加载信息源失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
  }, [filter])

  // 注意: 类型检测已移到后端测试时自动进行
  // 前端不再需要手动检测类型

  // 测试信息源
  const testSource = async (sourceId: string, sourceName: string) => {
    setTestingSourceId(sourceId)
    try {
      const response = await fetch(`/api/admin/sources/${sourceId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        // 显示测试结果弹窗
        setTestResultModal({
          show: true,
          sourceName: sourceName,
          sourceId: sourceId,
          result: data.testResult
        })
        loadSources()
      } else {
        alert('测试失败: ' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('测试失败:', error)
      alert('测试失败')
    } finally {
      setTestingSourceId(null)
    }
  }

  // 打开配置模式
  const openConfigModal = (source: Source) => {
    // 从 source.scrapeConfig 加载现有配置
    if (source.scrapeConfig) {
      setConfigFormData({
        excludePatterns: source.scrapeConfig.excludePatterns || [],
        includePatterns: source.scrapeConfig.includePatterns || []
      })
    } else {
      setConfigFormData({
        excludePatterns: [],
        includePatterns: []
      })
    }
    setShowConfigModal(true)
    setTestResultModal({ ...testResultModal, show: false })
  }

  // 保存配置并重新测试
  const saveConfigAndRetest = async () => {
    try {
      const sourceId = testResultModal.sourceId

      // 更新信息源的 scrapeConfig
      const response = await fetch(`/api/admin/sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrapeConfig: {
            excludePatterns: configFormData.excludePatterns.filter(p => p.trim()),
            includePatterns: configFormData.includePatterns.filter(p => p.trim())
          }
        })
      })

      if (response.ok) {
        setShowConfigModal(false)
        // 重新测试
        await testSource(sourceId, testResultModal.sourceName)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      alert('保存配置失败')
    }
  }

  // 激活/停用信息源
  const toggleActivate = async (sourceId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/sources/${sourceId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })
      const data = await response.json()
      if (data.success) {
        alert(isActive ? '信息源已激活' : '信息源已停用')
        loadSources()
      } else {
        alert(data.message || data.error)
      }
    } catch (error) {
      console.error('操作失败:', error)
      alert('操作失败')
    }
  }

  // 删除信息源
  const deleteSource = async (sourceId: string, sourceName: string) => {
    if (!confirm(`确定要删除信息源 "${sourceName}" 吗?`)) return
    try {
      const response = await fetch(`/api/admin/sources/${sourceId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        alert('删除成功')
        loadSources()
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  // 提交表单(新建或编辑)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingSource
        ? `/api/admin/sources/${editingSource.id}`
        : '/api/admin/sources'
      const method = editingSource ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await response.json()

      if (data.success) {
        alert('更新成功')
        setShowEditForm(false)
        setEditingSource(null)
        setFormData({ name: '', url: '', category: '', type: 'rss' })
        loadSources()
      } else {
        alert(data.error || '操作失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败')
    }
  }

  // 开始编辑
  const startEdit = (source: Source) => {
    setEditingSource(source)
    setFormData({
      name: source.name,
      url: source.url,
      category: source.category,
      type: source.type
    })
    setShowEditForm(true)
  }

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">信息源管理</h1>
          <p className="text-gray-600">管理和测试信息采集源</p>
        </div>

        {/* 操作栏 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded ${filter === 'active' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              已激活
            </button>
            <button
              onClick={() => setFilter('tested')}
              className={`px-4 py-2 rounded ${filter === 'tested' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              已测试
            </button>
            <button
              onClick={() => setFilter('untested')}
              className={`px-4 py-2 rounded ${filter === 'untested' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              未测试
            </button>
          </div>
          <button
            onClick={() => setShowSmartWizard(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium"
          >
            ➕ 添加信息源
          </button>
        </div>

        {/* 编辑表单 */}
        {showEditForm && editingSource && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">{editingSource ? '编辑信息源' : '添加新信息源'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="例如: TechCrunch"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="例如: 科技资讯"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/feed 或 https://example.com"
                />
                <p className="mt-1 text-sm text-gray-500">
                  💡 系统会自动检测采集方式: 优先尝试 RSS,失败则自动使用网页爬虫
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {editingSource ? '保存修改' : '创建信息源'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingSource(null)
                    setFormData({ name: '', url: '', category: '', type: 'rss' })
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 信息源列表 */}
        {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无信息源</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">测试状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">激活状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {source.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        {source.url}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {source.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded text-xs ${source.type === 'rss' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {source.type === 'rss' ? 'RSS' : 'Web'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {source.isTested ? (
                        <span className={`px-2 py-1 rounded text-xs ${source.testStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {source.testStatus === 'success' ? '✓ 通过' : '✗ 失败'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">未测试</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${source.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {source.isActive ? '✓ 已激活' : '未激活'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => testSource(source.id, source.name)}
                        disabled={testingSourceId === source.id}
                        className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                      >
                        {testingSourceId === source.id ? '测试中...' : '测试'}
                      </button>
                      {source.isTested && source.testStatus === 'success' && (
                        <button
                          onClick={() => toggleActivate(source.id, !source.isActive)}
                          className={source.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                        >
                          {source.isActive ? '停用' : '激活'}
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(source)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => deleteSource(source.id, source.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 统计信息 */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">总数</div>
            <div className="text-2xl font-bold">{sources.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">已激活</div>
            <div className="text-2xl font-bold text-green-600">
              {sources.filter(s => s.isActive).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">已测试</div>
            <div className="text-2xl font-bold text-blue-600">
              {sources.filter(s => s.isTested).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">测试成功</div>
            <div className="text-2xl font-bold text-purple-600">
              {sources.filter(s => s.testStatus === 'success').length}
            </div>
          </div>
        </div>

        {/* 测试结果弹窗 */}
        {testResultModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* 弹窗标题 */}
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  📊 测试结果: {testResultModal.sourceName}
                </h2>
                <button
                  onClick={() => setTestResultModal({ show: false, sourceName: '', sourceId: '', result: null })}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* 弹窗内容 */}
              <div className="flex-1 overflow-y-auto p-6">
                {testResultModal.result?.success ? (
                  <div>
                    {/* 成功状态 */}
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">✅</div>
                        <div>
                          <div className="text-lg font-semibold text-green-900">测试成功</div>
                          <div className="text-sm text-green-700">
                            成功采集 {testResultModal.result.count} 篇文章
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 测试日志 */}
                    {testResultModal.result.attemptLog && testResultModal.result.attemptLog.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">🔍 测试日志</h3>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {testResultModal.result.attemptLog.map((log: string, i: number) => (
                            <div
                              key={i}
                              className={`text-sm ${
                                log.startsWith('✓') || log.includes('成功')
                                  ? 'text-green-700'
                                  : log.startsWith('✗') || log.includes('失败')
                                  ? 'text-red-700'
                                  : 'text-gray-600'
                              }`}
                            >
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 提取策略信息 */}
                    {sources.find(s => s.id === testResultModal.sourceId)?.type === 'web' &&
                     testResultModal.result.articles &&
                     testResultModal.result.articles.length > 0 &&
                     testResultModal.result.articles[0].extractStrategy && (
                      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-900">
                          🔍 <strong>提取策略:</strong> {
                            testResultModal.result.articles[0].extractStrategy === 'heading-link'
                              ? '标题链接提取 (从 <h1-h3> 标签中提取)'
                              : testResultModal.result.articles[0].extractStrategy === 'generic-link'
                              ? '通用链接提取 (从所有 <a> 标签中提取)'
                              : testResultModal.result.articles[0].extractStrategy === 'article-container'
                              ? '文章容器提取 (从带有 post/article 类名的容器中提取)'
                              : testResultModal.result.articles[0].extractStrategy
                          }
                        </p>
                        {testResultModal.result.count < 5 && (
                          <p className="text-xs text-purple-700 mt-1">
                            ⚠️ 采集数量较少,可能需要配置过滤规则或检查网站结构
                          </p>
                        )}
                      </div>
                    )}

                    {/* 采集的文章列表 */}
                    {testResultModal.result.articles && testResultModal.result.articles.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                          📰 采集到的文章 (显示前 {Math.min(10, testResultModal.result.articles.length)} 篇)
                        </h3>
                        <div className="space-y-3">
                          {testResultModal.result.articles.slice(0, 10).map((article: any, i: number) => (
                            <div
                              key={i}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm">
                                  {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                                    {article.title}
                                  </h4>
                                  {article.description && (
                                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                      {article.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <a
                                      href={article.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline truncate max-w-md"
                                    >
                                      🔗 {article.link}
                                    </a>
                                    {article.pubDate && (
                                      <span>
                                        📅 {new Date(article.pubDate).toLocaleDateString('zh-CN')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {article.imageUrl && (
                                  <div className="flex-shrink-0">
                                    <img
                                      src={article.imageUrl}
                                      alt=""
                                      className="w-20 h-20 object-cover rounded"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {testResultModal.result.articles.length > 10 && (
                          <div className="mt-3 text-center text-sm text-gray-500">
                            还有 {testResultModal.result.articles.length - 10} 篇文章未显示
                          </div>
                        )}

                        {/* 数量较少时的提示 */}
                        {sources.find(s => s.id === testResultModal.sourceId)?.type === 'web' &&
                         testResultModal.result.count < 3 && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-900">
                              ⚠️ <strong>注意:</strong> 采集的文章数量较少 ({testResultModal.result.count} 篇)
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              可能的原因:
                            </p>
                            <ul className="text-xs text-yellow-700 mt-1 ml-4 list-disc">
                              <li>网页没有使用标准的 HTML 结构</li>
                              <li>内容由 JavaScript 动态加载 (需要浏览器渲染)</li>
                              <li>链接被过滤规则过滤掉了</li>
                            </ul>
                            <p className="text-xs text-yellow-700 mt-2">
                              💡 建议: 点击下方"配置采集规则"按钮,查看是否需要调整过滤规则
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 失败状态 */
                  <div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-3xl">❌</div>
                        <div>
                          <div className="text-lg font-semibold text-red-900">测试失败</div>
                          <div className="text-sm text-red-700">
                            {testResultModal.result?.error || '未知错误'}
                          </div>
                        </div>
                      </div>

                      {/* 测试日志 */}
                      {testResultModal.result?.attemptLog && testResultModal.result.attemptLog.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-red-900 mb-2">测试日志:</h4>
                          <div className="bg-white rounded p-3 space-y-1">
                            {testResultModal.result.attemptLog.map((log: string, i: number) => (
                              <div key={i} className="text-sm text-gray-700">
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-900">
                        💡 <strong>建议:</strong> 请检查 URL 是否正确,或者该网站可能需要自定义爬虫配置。
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 弹窗底部 */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <div>
                  {/* 左侧:配置按钮(仅web类型显示) */}
                  {sources.find(s => s.id === testResultModal.sourceId)?.type === 'web' && (
                    <button
                      onClick={() => {
                        const source = sources.find(s => s.id === testResultModal.sourceId)
                        if (source) openConfigModal(source)
                      }}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-2"
                    >
                      ⚙️ 配置采集规则
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTestResultModal({ show: false, sourceName: '', sourceId: '', result: null })}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    关闭
                  </button>
                  {testResultModal.result?.success && (
                    <button
                      onClick={() => {
                        setTestResultModal({ show: false, sourceName: '', sourceId: '', result: null })
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      确认
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配置对话框 */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* 对话框标题 */}
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  ⚙️ 配置采集规则
                </h2>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* 对话框内容 */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <p className="text-sm text-blue-900">
                      💡 <strong>提示:</strong> 通过配置规则可以过滤不需要的链接。规则为可选项,留空表示不应用该规则。
                    </p>
                  </div>

                  {/* 排除规则 */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🚫 排除 URL 模式 (可选)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      包含这些文本的链接将被排除。例如: /authors、/categories、/tags
                    </p>
                    <div className="space-y-2">
                      {configFormData.excludePatterns.map((pattern, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={pattern}
                            onChange={(e) => {
                              const newPatterns = [...configFormData.excludePatterns]
                              newPatterns[index] = e.target.value
                              setConfigFormData({ ...configFormData, excludePatterns: newPatterns })
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                            placeholder="/authors"
                          />
                          <button
                            onClick={() => {
                              const newPatterns = configFormData.excludePatterns.filter((_, i) => i !== index)
                              setConfigFormData({ ...configFormData, excludePatterns: newPatterns })
                            }}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setConfigFormData({
                            ...configFormData,
                            excludePatterns: [...configFormData.excludePatterns, '']
                          })
                        }}
                        className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-purple-400 hover:text-purple-600"
                      >
                        + 添加排除规则
                      </button>
                    </div>
                  </div>

                  {/* 包含规则 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ✅ 只包含 URL 模式 (可选)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      只保留包含这些文本的链接。例如: /article/、/posts/、/news/
                    </p>
                    <div className="space-y-2">
                      {configFormData.includePatterns.map((pattern, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={pattern}
                            onChange={(e) => {
                              const newPatterns = [...configFormData.includePatterns]
                              newPatterns[index] = e.target.value
                              setConfigFormData({ ...configFormData, includePatterns: newPatterns })
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                            placeholder="/article/"
                          />
                          <button
                            onClick={() => {
                              const newPatterns = configFormData.includePatterns.filter((_, i) => i !== index)
                              setConfigFormData({ ...configFormData, includePatterns: newPatterns })
                            }}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setConfigFormData({
                            ...configFormData,
                            includePatterns: [...configFormData.includePatterns, '']
                          })
                        }}
                        className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-purple-400 hover:text-purple-600"
                      >
                        + 添加包含规则
                      </button>
                    </div>
                  </div>
                </div>

                {/* 示例说明 */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-sm font-semibold text-gray-700 mb-2">📝 示例:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• 排除规则 "/authors" → 排除 https://example.com/authors/john</li>
                    <li>• 包含规则 "/article/" → 只保留 https://example.com/article/123</li>
                    <li>• 两种规则可以同时使用</li>
                    <li>• 留空则不应用该类规则</li>
                  </ul>
                </div>
              </div>

              {/* 对话框底部 */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={saveConfigAndRetest}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  保存并重新测试
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 智能添加向导 */}
        <SmartAddSourceWizard
          isOpen={showSmartWizard}
          onClose={() => setShowSmartWizard(false)}
          onSuccess={() => {
            loadSources()
          }}
        />

        {/* 返回按钮 */}
        <div className="mt-8">
          <a
            href="/admin"
            className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            ← 返回后台管理中心
          </a>
        </div>
        </div>
      </div>
    </AdminAuthGuard>
  )
}
