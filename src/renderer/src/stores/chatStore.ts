import { create } from 'zustand'
import type { ChatMessage } from '@shared/types'
import { api, unwrap } from '../api/client'

interface ChatState {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  commitHash: string | null

  sendMessage: (text: string, commitHash: string | null, context?: string) => Promise<void>
  clearChat: () => void
}

let msgCounter = 0

function makeId(): string {
  return `msg-${Date.now()}-${++msgCounter}`
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
  commitHash: null,

  sendMessage: async (text: string, currentCommitHash: string | null, context?: string) => {
    // Clear chat if commit changed
    if (currentCommitHash !== get().commitHash) {
      set({ messages: [], commitHash: currentCommitHash, error: null })
    }

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    set((s) => ({
      messages: [...s.messages, userMsg],
      loading: true,
      error: null
    }))

    try {
      // Build message history for the API (last 10 messages to stay within token limits)
      const history = [...get().messages].slice(-10).map((m) => ({
        role: m.role,
        content: m.content
      }))

      const result = await unwrap(api.chat.send(history, context))

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: result.text,
        timestamp: Date.now()
      }

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        loading: false
      }))
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      set({ loading: false, error: errorMsg })
    }
  },

  clearChat: () => {
    set({ messages: [], loading: false, error: null, commitHash: null })
  }
}))
