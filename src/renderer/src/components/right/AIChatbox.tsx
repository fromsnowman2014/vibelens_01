import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { cx } from '@renderer/lib/cx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Loader2, Trash2, Bot, User } from 'lucide-react'

export function AIChatbox() {
  const [input, setInput] = useState('')
  const { messages, loading, error, sendMessage, clearChat } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const selectedHash = useRepoStore((s) => s.selectedCommitHash)
  const language = useSettingsStore((s) => s.settings?.language ?? 'en')
  const cache = useAnalysisStore((s) => s.cache)

  // Get current analysis result as context
  const key = selectedHash ? `${selectedHash}:${language}` : ''
  const analysisResult = key ? cache[key] : undefined

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await sendMessage(text, selectedHash, analysisResult?.rawMarkdown)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Bot size={32} className="text-fg-muted mb-3 opacity-50" />
            <p className="text-[13px] text-fg-secondary mb-1">
              Ask questions about the selected commit
            </p>
            <p className="text-[11px] text-fg-muted">
              {analysisResult
                ? 'Analysis context will be included automatically.'
                : 'Select and analyze a commit first for contextual answers.'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cx(
              'flex gap-2.5',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
                <Bot size={13} className="text-accent" />
              </div>
            )}

            <div
              className={cx(
                'max-w-[85%] rounded-lg px-3 py-2 text-[12.5px]',
                msg.role === 'user'
                  ? 'bg-accent/15 text-fg-primary'
                  : 'bg-bg-secondary border border-border text-fg-primary'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className="ai-prose prose-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center mt-0.5">
                <User size={13} className="text-fg-muted" />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
              <Bot size={13} className="text-accent" />
            </div>
            <div className="bg-bg-secondary border border-border rounded-lg px-3 py-2">
              <Loader2 size={14} className="animate-spin text-accent" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-2.5 rounded bg-state-error/10 border border-state-error/30 text-[12px] text-state-error">
            {error}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-2.5">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this commit…"
              rows={1}
              className={cx(
                'w-full resize-none bg-bg-tertiary border border-border rounded-lg',
                'px-3 py-2 text-[12.5px] text-fg-primary',
                'placeholder:text-fg-muted/60',
                'focus:outline-none focus:border-accent transition-colors',
                'max-h-[100px] overflow-auto'
              )}
              style={{ minHeight: '36px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={cx(
              'flex-shrink-0 p-2 rounded-lg transition-colors',
              input.trim() && !loading
                ? 'bg-accent text-bg-primary hover:bg-accent-hover'
                : 'bg-bg-tertiary text-fg-muted cursor-not-allowed'
            )}
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex-shrink-0 p-2 rounded-lg bg-bg-tertiary text-fg-muted hover:text-fg-primary hover:bg-bg-elevated transition-colors"
              title="Clear chat"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
