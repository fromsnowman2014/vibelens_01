import { create } from 'zustand'

interface CommitDetailDrawer {
  isOpen: boolean
  commitHash: string | null
}

interface UIState {
  commitDetailDrawer: CommitDetailDrawer

  openCommitDetail: (hash: string) => void
  closeCommitDetail: () => void
}

export const useUIStore = create<UIState>((set) => ({
  commitDetailDrawer: {
    isOpen: false,
    commitHash: null
  },

  openCommitDetail: (hash: string) => {
    set({
      commitDetailDrawer: {
        isOpen: true,
        commitHash: hash
      }
    })
  },

  closeCommitDetail: () => {
    set({
      commitDetailDrawer: {
        isOpen: false,
        commitHash: null
      }
    })
  }
}))
