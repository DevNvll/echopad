import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Notebook, Note } from './types';
import { extractTags, extractUrls } from './utils/formatting';
import {
  getVaultPath,
  setVaultPath,
  getSetting,
  saveSetting,
  listNotebooks,
  createNotebook,
  renameNotebook,
  deleteNotebook,
  listNotes,
  readNote,
  createNote,
  updateNote,
  deleteNote,
  toggleNotebookPin,
  searchNotes,
  syncVaultTags,
  syncNoteTags,
  removeNoteTags,
  getAllTags,
  TagWithCount
} from './api';
import { Sidebar } from './components/Sidebar';
import { InputArea } from './components/InputArea';
import { MessageList } from './components/MessageList';
import { Modal } from './components/Modal';
import { ContextMenu, ContextMenuAction } from './components/ContextMenu';
import { CommandPalette } from './components/CommandPalette';
import { Hash, Trash2, Edit2, Copy, FolderOpen, FolderPlus, PanelLeftClose, PanelLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { TitleBar } from './components/TitleBar';

function App() {
  const [vaultPath, setVaultPathState] = useState<string | null>(null);
  const [isVaultSetupOpen, setIsVaultSetupOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [commandInitialSearch, setCommandInitialSearch] = useState('');

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | 'create-sub'>('create');
  const [notebookFormName, setNotebookFormName] = useState('');
  const [targetNotebook, setTargetNotebook] = useState<Notebook | null>(null);
  const [parentNotebook, setParentNotebook] = useState<Notebook | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'notebook' | 'message';
    data: Notebook | Note;
  } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const vault = await getVaultPath();
      if (vault) {
        setVaultPathState(vault);
        const savedWidth = await getSetting<number>('sidebarWidth', 260);
        setSidebarWidth(savedWidth);
        const collapsed = await getSetting<boolean>('sidebarCollapsed', false);
        setIsSidebarCollapsed(collapsed);
        const lastNotebook = await getSetting<string | null>('lastActiveNotebook', null);
        if (lastNotebook) {
          setActiveNotebook(lastNotebook);
        }
      } else {
        setIsVaultSetupOpen(true);
      }
      setIsInitialized(true);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!vaultPath) return;
    
    const loadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath);
      setNotebooks(nbs);
    };
    loadNotebooks();
  }, [vaultPath]);

  useEffect(() => {
    if (!vaultPath) return;
    
    const loadTags = async () => {
      await syncVaultTags(vaultPath);
      const tags = await getAllTags();
      setAllTags(tags);
    };
    loadTags();
  }, [vaultPath]);

  const flattenNotebooks = useCallback((nbs: Notebook[]): Notebook[] => {
    const result: Notebook[] = [];
    for (const nb of nbs) {
      result.push(nb);
      if (nb.children) {
        result.push(...flattenNotebooks(nb.children));
      }
    }
    return result;
  }, []);

  const allNotebooks = useMemo(() => flattenNotebooks(notebooks), [notebooks, flattenNotebooks]);

  useEffect(() => {
    if (isInitialized && notebooks.length > 0 && !activeNotebook) {
      const defaultNb = notebooks[0].relativePath;
      setActiveNotebook(defaultNb);
      saveSetting('lastActiveNotebook', defaultNb);
    }
  }, [notebooks, activeNotebook, isInitialized]);

  useEffect(() => {
    if (!vaultPath || !activeNotebook) {
      setNotes([]);
      return;
    }

    const loadNotes = async () => {
      setIsLoadingNotes(true);
      try {
        const metadata = await listNotes(vaultPath, activeNotebook);
        const loadedNotes: Note[] = [];
        for (const meta of metadata) {
          const note = await readNote(vaultPath, activeNotebook, meta.filename);
          loadedNotes.push(note);
        }
        setNotes(loadedNotes);
      } catch (err) {
        console.error('Failed to load notes:', err);
        setNotes([]);
      } finally {
        setIsLoadingNotes(false);
      }
    };
    loadNotes();
  }, [vaultPath, activeNotebook]);

  const notebookMap = useMemo(() => {
    return allNotebooks.reduce((acc, nb) => {
      acc[nb.relativePath] = nb.name;
      return acc;
    }, {} as Record<string, string>);
  }, [allNotebooks]);

  const handleSelectVault = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Vault Folder'
    });
    
    if (selected && typeof selected === 'string') {
      await setVaultPath(selected);
      setVaultPathState(selected);
      setIsVaultSetupOpen(false);
    }
  };

  const handleSelectNotebook = (relativePath: string) => {
    setActiveNotebook(relativePath);
    setTargetMessageId(null);
    saveSetting('lastActiveNotebook', relativePath);
  };

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const widthRef = React.useRef(sidebarWidth);
  useEffect(() => { widthRef.current = sidebarWidth; }, [sidebarWidth]);

  const stopResizingWrapper = useCallback(() => {
    setIsResizing(false);
    saveSetting('sidebarWidth', widthRef.current);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth >= 200 && newWidth <= 480) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newValue = !prev;
      saveSetting('sidebarCollapsed', newValue);
      return newValue;
    });
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizingWrapper);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizingWrapper);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizingWrapper);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, resize, stopResizingWrapper]);

  const handleSendMessage = async (content: string) => {
    if (!vaultPath || !activeNotebook) return;
    setTargetMessageId(null);
    
    const newNote = await createNote(vaultPath, activeNotebook, content);
    setNotes(prev => [...prev, newNote]);
    
    await syncNoteTags(newNote);
    const tags = await getAllTags();
    setAllTags(tags);
  };

  const handleEditMessage = useCallback(async (filename: string, newContent: string) => {
    if (!vaultPath || !activeNotebook) return;
    
    const updated = await updateNote(vaultPath, activeNotebook, filename, newContent);
    setNotes(prev => prev.map(n => n.filename === filename ? updated : n));
    setEditingMessageId(null);
    
    await syncNoteTags(updated);
    const tags = await getAllTags();
    setAllTags(tags);
  }, [vaultPath, activeNotebook]);

  const handleDeleteMessage = async (filename: string) => {
    if (!vaultPath || !activeNotebook) return;
    
    await removeNoteTags(filename, activeNotebook);
    await deleteNote(vaultPath, activeNotebook, filename);
    setNotes(prev => prev.filter(n => n.filename !== filename));
    
    const tags = await getAllTags();
    setAllTags(tags);
  };

  const handleCreateNotebook = async () => {
    if (!vaultPath || !notebookFormName.trim()) return;
    
    const name = notebookFormName.trim().toLowerCase().replace(/\s+/g, '-');
    const parentPath = parentNotebook?.relativePath;
    const nb = await createNotebook(vaultPath, name, parentPath);
    
    const reloadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath);
      setNotebooks(nbs);
    };
    await reloadNotebooks();
    
    setNotebookFormName('');
    setIsNotebookModalOpen(false);
    setParentNotebook(null);
    handleSelectNotebook(nb.relativePath);
  };

  const handleUpdateNotebook = async () => {
    if (!vaultPath || !targetNotebook || !notebookFormName.trim()) return;
    
    const newName = notebookFormName.trim().toLowerCase().replace(/\s+/g, '-');
    const updated = await renameNotebook(vaultPath, targetNotebook.relativePath, newName);
    
    const reloadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath);
      setNotebooks(nbs);
    };
    await reloadNotebooks();
    
    if (activeNotebook === targetNotebook.relativePath) {
      setActiveNotebook(updated.relativePath);
      saveSetting('lastActiveNotebook', updated.relativePath);
    }
    setIsNotebookModalOpen(false);
    setTargetNotebook(null);
  };

  const handleDeleteNotebook = async () => {
    if (!vaultPath || !targetNotebook) return;
    
    await deleteNotebook(vaultPath, targetNotebook.relativePath);
    
    const reloadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath);
      setNotebooks(nbs);
    };
    await reloadNotebooks();
    
    setIsNotebookModalOpen(false);
    setTargetNotebook(null);
    
    if (activeNotebook === targetNotebook.relativePath) {
      const remaining = allNotebooks.find(nb => nb.relativePath !== targetNotebook.relativePath);
      const newActive = remaining?.relativePath || null;
      setActiveNotebook(newActive);
      if (newActive) saveSetting('lastActiveNotebook', newActive);
    }
  };

  const updateNotebookInTree = useCallback((
    nbs: Notebook[],
    targetPath: string,
    updater: (nb: Notebook) => Notebook
  ): Notebook[] => {
    return nbs.map(nb => {
      if (nb.relativePath === targetPath) {
        return updater(nb);
      }
      if (nb.children) {
        return { ...nb, children: updateNotebookInTree(nb.children, targetPath, updater) };
      }
      return nb;
    });
  }, []);

  const handleTogglePin = async (notebook: Notebook) => {
    const isPinned = await toggleNotebookPin(notebook.relativePath);
    setNotebooks(prev => updateNotebookInTree(prev, notebook.relativePath, nb => ({ ...nb, isPinned })));
  };

  const onNotebookContextMenu = (e: React.MouseEvent, notebook: Notebook) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'notebook',
      data: notebook
    });
  };

  const onMessageContextMenu = useCallback((e: React.MouseEvent, note: Note) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'message',
      data: note
    });
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const handleContextMenuAction = (action: ContextMenuAction) => {
    if (!contextMenu) return;

    if (contextMenu.type === 'notebook') {
      const notebook = contextMenu.data as Notebook;
      if (action === 'edit') {
        setModalMode('edit');
        setTargetNotebook(notebook);
        setNotebookFormName(notebook.name);
        setIsNotebookModalOpen(true);
      } else if (action === 'delete') {
        setModalMode('delete');
        setTargetNotebook(notebook);
        setIsNotebookModalOpen(true);
      } else if (action === 'create-sub') {
        setModalMode('create-sub');
        setParentNotebook(notebook);
        setNotebookFormName('');
        setIsNotebookModalOpen(true);
      }
    } else if (contextMenu.type === 'message') {
      const note = contextMenu.data as Note;
      if (action === 'edit') {
        setEditingMessageId(note.filename);
      } else if (action === 'delete') {
        handleDeleteMessage(note.filename);
      } else if (action === 'copy') {
        navigator.clipboard.writeText(note.content);
      }
    }
    setContextMenu(null);
  };

  const handleSearchResultClick = async (note: Note) => {
    if (note.notebookName) {
      setTargetMessageId(note.filename);
      handleSelectNotebook(note.notebookName);
    }
  };

  const handleTagClick = useCallback((tag: string) => {
    setCommandInitialSearch(`#${tag}`);
    setIsCommandOpen(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyContent = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        if (isCommandOpen && e.ctrlKey && !e.metaKey) {
          return;
        }
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isCommandOpen]);

  const currentNotebook = allNotebooks.find(nb => nb.relativePath === activeNotebook);

  if (isVaultSetupOpen || !vaultPath) {
    return (
      <div className="h-screen w-screen bg-transparent font-sans text-textMain">
        <div className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background">
          <TitleBar onOpenCommandPalette={() => setIsCommandOpen(true)} />
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full mx-4 bg-surface border border-border rounded-2xl p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-brand" />
                </div>
                <div>
                  <h1 className="text-xl font-bold mb-2">Welcome to Lazuli</h1>
                  <p className="text-textMuted text-sm">
                    To get started, select or create a folder where your notes will be stored. 
                    This will be your vault - all notebooks and notes will live here.
                  </p>
                </div>
                <button
                  onClick={handleSelectVault}
                  className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Select Vault Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-transparent font-sans text-textMain">
      <div 
        className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background"
        onClick={() => setContextMenu(null)}
      >
        <TitleBar onOpenCommandPalette={() => setIsCommandOpen(true)} />
        <div className="flex flex-1 min-h-0">
          {!isSidebarCollapsed && (
        <>
          <Sidebar 
            notebooks={notebooks}
            activeNotebook={activeNotebook}
            onSelectNotebook={handleSelectNotebook}
            onCreateNotebook={() => {
              setModalMode('create');
              setNotebookFormName('');
              setIsNotebookModalOpen(true);
            }}
            onCreateSubnotebook={(parent) => {
              setModalMode('create-sub');
              setParentNotebook(parent);
              setNotebookFormName('');
              setIsNotebookModalOpen(true);
            }}
            onContextMenu={onNotebookContextMenu}
            onTogglePin={handleTogglePin}
            width={sidebarWidth}
            vaultPath={vaultPath}
            onChangeVault={handleSelectVault}
          />

          <div
            className={clsx(
              "w-1 hover:w-1.5 -ml-0.5 hover:-ml-0.75 z-30 cursor-col-resize flex flex-col justify-center items-center transition-all group select-none",
              isResizing ? "bg-brand/50 w-1.5" : "hover:bg-brand/50"
            )}
            onMouseDown={startResizing}
          >
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-background relative shadow-2xl">
        <div className="h-16 border-b border-border/40 flex items-center pl-4 pr-8 justify-between bg-glass backdrop-blur-md z-20 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
              title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <Hash className="text-textMuted/50" size={20} />
            <span className="font-bold text-textMain text-base tracking-tight leading-none">{currentNotebook?.name}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-row min-h-0 pt-16 relative bg-[#050505]">
          <div className="flex-1 flex flex-col min-w-0 z-0">
            <MessageList 
              notes={notes}
              isLoading={isLoadingNotes}
              targetMessageId={targetMessageId}
              notebooks={notebookMap}
              onContextMenu={onMessageContextMenu}
              editingMessageId={editingMessageId}
              onEditSubmit={handleEditMessage}
              onEditCancel={handleEditCancel}
              vaultPath={vaultPath}
              onTagClick={handleTagClick}
              onEditStart={setEditingMessageId}
              onCopy={handleCopyContent}
              onDelete={handleDeleteMessage}
              onScroll={handleCloseContextMenu}
            />
            <InputArea 
              channelName={currentNotebook?.name || 'unknown'} 
              onSendMessage={handleSendMessage}
              vaultPath={vaultPath}
            />
          </div>
        </div>
      </div>

      <CommandPalette 
        isOpen={isCommandOpen}
        setIsOpen={(open) => {
          setIsCommandOpen(open);
          if (!open) setCommandInitialSearch('');
        }}
        notebooks={notebooks}
        vaultPath={vaultPath}
        onSelectNotebook={handleSelectNotebook}
        onSelectMessage={handleSearchResultClick}
        onCreateNotebook={() => {
          setModalMode('create');
          setNotebookFormName('');
          setIsNotebookModalOpen(true);
        }}
        allTags={allTags}
        initialSearch={commandInitialSearch}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSelect={handleContextMenuAction}
          items={contextMenu.type === 'notebook' ? [
            { label: 'Create Subnotebook', action: 'create-sub', icon: <FolderPlus size={12} /> },
            { label: 'Edit Notebook', action: 'edit', icon: <Edit2 size={12} /> },
            { label: 'Delete Notebook', action: 'delete', icon: <Trash2 size={12} />, destructive: true },
          ] : [
            { label: 'Edit Note', action: 'edit', icon: <Edit2 size={12} /> },
            { label: 'Copy Text', action: 'copy', icon: <Copy size={12} /> },
            { label: 'Delete Note', action: 'delete', icon: <Trash2 size={12} />, destructive: true },
          ]}
        />
      )}

      <Modal
        isOpen={isNotebookModalOpen}
        onClose={() => {
          setIsNotebookModalOpen(false);
          setParentNotebook(null);
        }}
        title={
          modalMode === 'create' ? 'Create Notebook' : 
          modalMode === 'create-sub' ? `Create Subnotebook in ${parentNotebook?.name}` :
          modalMode === 'edit' ? 'Edit Notebook' : 
          'Delete Notebook'
        }
        submitLabel={
          modalMode === 'create' || modalMode === 'create-sub' ? 'Create' : 
          modalMode === 'edit' ? 'Save Changes' : 
          'Delete'
        }
        isDestructive={modalMode === 'delete'}
        onSubmit={() => {
          if (modalMode === 'create' || modalMode === 'create-sub') handleCreateNotebook();
          if (modalMode === 'edit') handleUpdateNotebook();
          if (modalMode === 'delete') handleDeleteNotebook();
        }}
      >
        {modalMode === 'delete' ? (
          <div className="text-textMuted text-sm">
            Are you sure you want to delete <span className="font-bold text-textMain">{targetNotebook?.name}</span>? 
            This will delete all notes and subnotebooks within this notebook. <br/><br/>
            <span className="text-red-400 font-bold uppercase text-xs">This action cannot be undone.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {modalMode === 'create-sub' && parentNotebook && (
              <div className="text-textMuted text-sm mb-2">
                Creating inside: <span className="text-textMain font-medium">{parentNotebook.relativePath}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-textMuted uppercase mb-1.5">
                {modalMode === 'create-sub' ? 'Subnotebook Name' : 'Notebook Name'}
              </label>
              <input 
                value={notebookFormName}
                onChange={(e) => setNotebookFormName(e.target.value)}
                className="w-full bg-black border border-border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-brand/50 placeholder-textMuted/30"
                placeholder="e.g. project-alpha"
                autoFocus
              />
            </div>
          </div>
        )}
      </Modal>
        </div>
      </div>
    </div>
  );
}

export default App;

