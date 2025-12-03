import { create } from 'zustand'
import { KanbanBoard, KanbanColumn, KanbanCard, BoardMetadata } from '../types'
import {
  listBoards,
  readBoard,
  createBoard as apiCreateBoard,
  updateBoard as apiUpdateBoard,
  deleteBoard as apiDeleteBoard,
  toggleBoardPin,
  getPinnedBoards,
  getBoardOrder,
  updateBoardOrder,
  getCollectionOrder,
  updateCollectionOrder
} from '../api'

function generateCardId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function extractTags(content: string): string[] {
  const tagRegex = /#(\w+)/g
  const tags: string[] = []
  let match
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1])
  }
  return tags
}

interface BoardState {
  boards: BoardMetadata[]
  activeBoard: string | null
  isLoaded: boolean
  currentBoard: KanbanBoard | null
  isLoading: boolean
  pinnedBoards: string[]
  boardOrder: string[]
  collectionOrder: string[]

  loadBoards: (vaultPath: string) => Promise<void>
  loadBoard: (vaultPath: string, filename: string) => Promise<void>
  createBoard: (vaultPath: string, title: string) => Promise<KanbanBoard>
  updateBoard: (
    vaultPath: string,
    filename: string,
    title: string,
    columns: KanbanColumn[]
  ) => Promise<void>
  deleteBoard: (vaultPath: string, filename: string) => Promise<void>
  renameBoard: (vaultPath: string, filename: string, newTitle: string) => Promise<void>
  togglePin: (filename: string) => Promise<void>
  selectBoard: (filename: string | null) => void
  reorderBoards: (orderedFilenames: string[]) => void
  reorderCollection: (orderedIds: string[]) => void

  addColumn: (title: string) => void
  removeColumn: (columnId: string) => void
  reorderColumns: (columnIds: string[]) => void
  renameColumn: (columnId: string, newTitle: string) => void

  addCard: (columnId: string, content: string) => void
  removeCard: (columnId: string, cardId: string) => void
  moveCard: (
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex: number
  ) => void
  updateCard: (columnId: string, cardId: string, content: string) => void

  saveCurrentBoard: (vaultPath: string) => Promise<void>
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  activeBoard: null,
  isLoaded: false,
  currentBoard: null,
  isLoading: false,
  pinnedBoards: [],
  boardOrder: [],
  collectionOrder: [],

  loadBoards: async (vaultPath: string) => {
    const [metadata, pinned, order, collection] = await Promise.all([
      listBoards(vaultPath),
      getPinnedBoards(),
      getBoardOrder(),
      getCollectionOrder()
    ])
    set({ boards: metadata, pinnedBoards: pinned, boardOrder: order, collectionOrder: collection, isLoaded: true })
  },

  loadBoard: async (vaultPath: string, filename: string) => {
    set({ isLoading: true })
    try {
      const board = await readBoard(vaultPath, filename)
      set({
        currentBoard: board,
        activeBoard: filename,
        isLoading: false
      })
    } catch (err) {
      console.error('Failed to load board:', err)
      set({ isLoading: false })
    }
  },

  createBoard: async (vaultPath: string, title: string) => {
    const board = await apiCreateBoard(vaultPath, title)
    set((state) => ({
      boards: [
        { filename: board.filename, createdAt: board.createdAt, title: board.title },
        ...state.boards
      ],
      activeBoard: board.filename,
      currentBoard: board
    }))
    return board
  },

  updateBoard: async (
    vaultPath: string,
    filename: string,
    title: string,
    columns: KanbanColumn[]
  ) => {
    const updated = await apiUpdateBoard(vaultPath, filename, title, columns)
    set({ currentBoard: updated })
  },

  deleteBoard: async (vaultPath: string, filename: string) => {
    await apiDeleteBoard(vaultPath, filename)
    set((state) => ({
      boards: state.boards.filter((b) => b.filename !== filename),
      pinnedBoards: state.pinnedBoards.filter((f) => f !== filename),
      currentBoard: state.activeBoard === filename ? null : state.currentBoard,
      activeBoard: state.activeBoard === filename ? null : state.activeBoard
    }))
  },

  renameBoard: async (vaultPath: string, filename: string, newTitle: string) => {
    const { currentBoard } = get()

    // If this board is currently loaded, update it with new title
    if (currentBoard && currentBoard.filename === filename) {
      const updated = await apiUpdateBoard(vaultPath, filename, newTitle, currentBoard.columns)
      set((state) => ({
        currentBoard: updated,
        boards: state.boards.map((b) =>
          b.filename === filename ? { ...b, title: newTitle } : b
        )
      }))
    } else {
      // Need to load the board first to get its columns
      const board = await readBoard(vaultPath, filename)
      await apiUpdateBoard(vaultPath, filename, newTitle, board.columns)
      set((state) => ({
        boards: state.boards.map((b) =>
          b.filename === filename ? { ...b, title: newTitle } : b
        )
      }))
    }
  },

  togglePin: async (filename: string) => {
    const isPinned = await toggleBoardPin(filename)
    set((state) => ({
      pinnedBoards: isPinned
        ? [...state.pinnedBoards, filename]
        : state.pinnedBoards.filter((f) => f !== filename),
      currentBoard:
        state.currentBoard?.filename === filename
          ? { ...state.currentBoard, isPinned }
          : state.currentBoard
    }))
  },

  selectBoard: (filename: string | null) => {
    set({ activeBoard: filename })
  },

  reorderBoards: (orderedFilenames: string[]) => {
    set({ boardOrder: orderedFilenames })
    updateBoardOrder(orderedFilenames)
  },

  reorderCollection: (orderedIds: string[]) => {
    set({ collectionOrder: orderedIds })
    updateCollectionOrder(orderedIds)
  },

  addColumn: (title: string) => {
    set((state) => {
      if (!state.currentBoard) return state

      const newColumn: KanbanColumn = {
        id: `col-${Date.now()}`,
        title,
        cards: []
      }

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: [...state.currentBoard.columns, newColumn]
        }
      }
    })
  },

  removeColumn: (columnId: string) => {
    set((state) => {
      if (!state.currentBoard) return state

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: state.currentBoard.columns.filter((c) => c.id !== columnId)
        }
      }
    })
  },

  reorderColumns: (columnIds: string[]) => {
    set((state) => {
      if (!state.currentBoard) return state

      const columnMap = new Map(
        state.currentBoard.columns.map((c) => [c.id, c])
      )
      const reordered = columnIds
        .map((id) => columnMap.get(id))
        .filter(Boolean) as KanbanColumn[]

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: reordered
        }
      }
    })
  },

  renameColumn: (columnId: string, newTitle: string) => {
    set((state) => {
      if (!state.currentBoard) return state

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: state.currentBoard.columns.map((c) =>
            c.id === columnId ? { ...c, title: newTitle } : c
          )
        }
      }
    })
  },

  addCard: (columnId: string, content: string) => {
    set((state) => {
      if (!state.currentBoard) return state

      const newCard: KanbanCard = {
        id: generateCardId(),
        content,
        tags: extractTags(content)
      }

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: state.currentBoard.columns.map((c) =>
            c.id === columnId ? { ...c, cards: [...c.cards, newCard] } : c
          )
        }
      }
    })
  },

  removeCard: (columnId: string, cardId: string) => {
    set((state) => {
      if (!state.currentBoard) return state

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: state.currentBoard.columns.map((c) =>
            c.id === columnId
              ? { ...c, cards: c.cards.filter((card) => card.id !== cardId) }
              : c
          )
        }
      }
    })
  },

  moveCard: (
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex: number
  ) => {
    set((state) => {
      if (!state.currentBoard) return state

      let movedCard: KanbanCard | null = null
      const columns = state.currentBoard.columns.map((col) => {
        if (col.id === fromColumnId) {
          const card = col.cards.find((c) => c.id === cardId)
          if (card) {
            movedCard = card
            return {
              ...col,
              cards: col.cards.filter((c) => c.id !== cardId)
            }
          }
        }
        return col
      })

      if (!movedCard) return state

      const finalColumns = columns.map((col) => {
        if (col.id === toColumnId) {
          const newCards = [...col.cards]
          newCards.splice(toIndex, 0, movedCard!)
          return { ...col, cards: newCards }
        }
        return col
      })

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: finalColumns
        }
      }
    })
  },

  updateCard: (columnId: string, cardId: string, content: string) => {
    set((state) => {
      if (!state.currentBoard) return state

      return {
        currentBoard: {
          ...state.currentBoard,
          columns: state.currentBoard.columns.map((c) =>
            c.id === columnId
              ? {
                  ...c,
                  cards: c.cards.map((card) =>
                    card.id === cardId
                      ? { ...card, content, tags: extractTags(content) }
                      : card
                  )
                }
              : c
          )
        }
      }
    })
  },

  saveCurrentBoard: async (vaultPath: string) => {
    const { currentBoard } = get()
    if (!currentBoard) return

    await apiUpdateBoard(
      vaultPath,
      currentBoard.filename,
      currentBoard.title,
      currentBoard.columns
    )
  }
}))
