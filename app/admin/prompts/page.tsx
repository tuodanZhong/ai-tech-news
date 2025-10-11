'use client'

import { useEffect, useState } from 'react'
import AdminAuthGuard from '@/components/AdminAuthGuard'

interface PromptConfig {
  id: string
  key: string
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate: string
  outputFormat: string
  temperature?: number
  useJsonMode: boolean
  version: number
  updatedAt: string
}

export default function PromptsManagementPage() {
  const [prompts, setPrompts] = useState<PromptConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editedSystemPrompt, setEditedSystemPrompt] = useState('')
  const [editedUserPromptTemplate, setEditedUserPromptTemplate] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 加载提示词列表
  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/admin/prompts')
      const data = await response.json()

      if (data.success) {
        setPrompts(data.prompts)
      } else {
        showMessage('error', '加载提示词失败: ' + data.error)
      }
    } catch (error) {
      showMessage('error', '加载提示词失败')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const startEdit = (prompt: PromptConfig) => {
    setEditingKey(prompt.key)
    setEditedSystemPrompt(prompt.systemPrompt)
    setEditedUserPromptTemplate(prompt.userPromptTemplate)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditedSystemPrompt('')
    setEditedUserPromptTemplate('')
  }

  const savePrompt = async (key: string) => {
    setSaving(key)
    try {
      const response = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          systemPrompt: editedSystemPrompt,
          userPromptTemplate: editedUserPromptTemplate
        })
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', '提示词已保存')
        setEditingKey(null)
        setEditedSystemPrompt('')
        await loadPrompts() // 重新加载以更新版本号
      } else {
        showMessage('error', '保存失败: ' + data.error)
      }
    } catch (error) {
      showMessage('error', '保存失败')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-gray-600">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">提示词管理</h1>
          <p className="text-gray-600">
            管理 DeepSeek API 提示词配置。您可以编辑<strong>智能体描述</strong>和<strong>提示词内容</strong>（包括规则和标准）。
          </p>
          <p className="text-sm text-amber-600 mt-2">
            ⚠️ 注意：编辑提示词模板时，请保留变量占位符（如 {`{{count}}`}、{`{{feedUrl}}`}），否则功能将无法正常工作。
          </p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* 提示词卡片列表 */}
        <div className="space-y-6">
          {prompts.map((prompt) => (
            <div key={prompt.key} className="bg-white rounded-lg shadow-md border border-gray-200">
              {/* 卡片头部 */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{prompt.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">版本 v{prompt.version}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(prompt.updatedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* 卡片内容 */}
              <div className="p-6 space-y-6">
                {/* System Prompt - 可编辑 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      智能体描述 (System Prompt)
                      <span className="ml-2 text-green-600 text-xs">✓ 可编辑</span>
                    </label>
                    {editingKey !== prompt.key && (
                      <button
                        onClick={() => startEdit(prompt)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        编辑
                      </button>
                    )}
                  </div>
                  {editingKey === prompt.key ? (
                    <div>
                      <textarea
                        value={editedSystemPrompt}
                        onChange={(e) => setEditedSystemPrompt(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => savePrompt(prompt.key)}
                          disabled={saving === prompt.key}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving === prompt.key ? '保存中...' : '保存'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving === prompt.key}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-gray-800">
                      {prompt.systemPrompt}
                    </div>
                  )}
                </div>

                {/* User Prompt Template - 可编辑 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    用户提示词模板 (User Prompt Template)
                    <span className="ml-2 text-green-600 text-xs">✓ 可编辑</span>
                  </label>
                  {editingKey === prompt.key ? (
                    <div>
                      <textarea
                        value={editedUserPromptTemplate}
                        onChange={(e) => setEditedUserPromptTemplate(e.target.value)}
                        rows={15}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="输入提示词模板，包含规则、标准和变量占位符..."
                      />
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ 请保留变量占位符（如 {`{{count}}`}, {`{{feedUrl}}`}），否则功能将无法工作
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-gray-800 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {prompt.userPromptTemplate}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        包含变量占位符（如 {`{{count}}`}, {`{{feedUrl}}`}），运行时自动替换
                      </p>
                    </div>
                  )}
                </div>

                {/* Output Format - 只读 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    输出格式 (Output Format)
                    <span className="ml-2 text-gray-400 text-xs">🔒 只读</span>
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600 font-mono whitespace-pre-wrap">
                    {prompt.outputFormat}
                  </div>
                </div>

                {/* 配置参数 - 只读 */}
                <div className="flex gap-4 text-sm">
                  <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="text-gray-500 mb-1">Temperature</div>
                    <div className="text-gray-800 font-semibold">
                      {prompt.temperature !== null && prompt.temperature !== undefined
                        ? prompt.temperature
                        : '未设置'}
                    </div>
                  </div>
                  <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="text-gray-500 mb-1">JSON 模式</div>
                    <div className="text-gray-800 font-semibold">
                      {prompt.useJsonMode ? '✓ 启用' : '✗ 禁用'}
                    </div>
                  </div>
                  <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="text-gray-500 mb-1">Key</div>
                    <div className="text-gray-800 font-mono text-xs">{prompt.key}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

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
