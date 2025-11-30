import React, { useMemo, useState, useEffect } from 'react'
import { X, Image, Link2, FileText, ExternalLink, Copy, Check, ChevronRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useVaultStore, useNotebookStore, useUIStore } from '../stores'
import { NoteImage } from './NoteImage'
import { getAllNotesFromNotebook } from '../api'
import { Note } from '../types'

type MediaTab = 'images' | 'links' | 'files'

interface ExtractedImage {
  src: string
  alt: string
  noteFilename: string
  noteDate: number
}

interface ExtractedLink {
  url: string
  noteFilename: string
  noteDate: number
}

interface ExtractedFile {
  path: string
  extension: string
  noteFilename: string
  noteDate: number
}

// Extract markdown images from content: ![alt](src)
function extractImages(content: string, filename: string, date: number): ExtractedImage[] {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const images: ExtractedImage[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    images.push({
      alt: match[1] || 'Image',
      src: match[2],
      noteFilename: filename,
      noteDate: date
    })
  }

  return images
}

// Extract file links from content: [text](path)
function extractFiles(content: string, filename: string, date: number): ExtractedFile[] {
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g
  const files: ExtractedFile[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    const path = match[2]
    // Skip URLs and image links
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      continue
    }
    // Skip if it's an image (already captured by extractImages)
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(path)) {
      continue
    }
    
    const extension = path.split('.').pop()?.toLowerCase() || ''
    files.push({
      path,
      extension,
      noteFilename: filename,
      noteDate: date
    })
  }

  return files
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    className={clsx(
      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
      active
        ? 'bg-brand/15 text-brand'
        : 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50'
    )}
  >
    {icon}
    <span className="font-medium">{label}</span>
    <span className={clsx(
      'text-xs px-1.5 py-0.5 rounded-full',
      active ? 'bg-brand/20 text-brand' : 'bg-surfaceHighlight text-textMuted'
    )}>
      {count}
    </span>
  </button>
)

const ImageCard: React.FC<{
  image: ExtractedImage
  vaultPath: string
}> = ({ image, vaultPath }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="group rounded-lg overflow-hidden bg-black/30 border border-border/40 hover:border-brand/30 transition-all">
      <div 
        className="aspect-video relative cursor-pointer overflow-hidden"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {image.src.startsWith('http') ? (
          <img
            src={image.src}
            alt={image.alt}
            className={clsx(
              'w-full h-full object-cover transition-transform duration-300',
              'group-hover:scale-105'
            )}
          />
        ) : (
          <div className="w-full h-full">
            <NoteImage src={image.src} alt={image.alt} vaultPath={vaultPath} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-2.5">
        <p className="text-xs text-textMuted truncate" title={image.alt}>
          {image.alt || image.src.split('/').pop()}
        </p>
        <p className="text-[10px] text-textMuted/50 mt-1">
          {formatDate(image.noteDate)}
        </p>
      </div>
    </div>
  )
}

const LinkCard: React.FC<{
  link: ExtractedLink
}> = ({ link }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpen = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div 
      className="group p-3 rounded-lg bg-black/30 border border-border/40 hover:border-brand/30 transition-all cursor-pointer"
      onClick={handleOpen}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
          <Link2 size={14} className="text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-textMain truncate font-medium">
            {getDomain(link.url)}
          </p>
          <p className="text-xs text-textMuted/60 truncate mt-0.5" title={link.url}>
            {link.url}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-surfaceHighlight text-textMuted hover:text-textMain transition-colors"
            title="Copy URL"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
          <button
            onClick={handleOpen}
            className="p-1.5 rounded-md hover:bg-surfaceHighlight text-textMuted hover:text-textMain transition-colors"
            title="Open link"
          >
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
        <span className="text-[10px] text-textMuted/50">
          {formatDate(link.noteDate)}
        </span>
      </div>
    </div>
  )
}

const FileCard: React.FC<{
  file: ExtractedFile
}> = ({ file }) => {
  const getFileIcon = (ext: string) => {
    const iconMap: Record<string, string> = {
      pdf: '📄',
      doc: '📝',
      docx: '📝',
      txt: '📄',
      md: '📝',
      json: '{}',
      csv: '📊',
      xlsx: '📊',
      xls: '📊',
      zip: '📦',
      default: '📁'
    }
    return iconMap[ext] || iconMap.default
  }

  return (
    <div className="group p-3 rounded-lg bg-black/30 border border-border/40 hover:border-brand/30 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-surfaceHighlight flex items-center justify-center text-sm shrink-0">
          {getFileIcon(file.extension)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-textMain truncate">
            {file.path.split('/').pop()}
          </p>
          <p className="text-xs text-textMuted/50 uppercase tracking-wide mt-0.5">
            {file.extension || 'File'}
          </p>
        </div>
        <ChevronRight size={14} className="text-textMuted/30 group-hover:text-textMuted transition-colors" />
      </div>
    </div>
  )
}

const EmptyState: React.FC<{
  icon: React.ReactNode
  title: string
  description: string
}> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="w-12 h-12 rounded-xl bg-surfaceHighlight/50 flex items-center justify-center text-textMuted/40 mb-3">
      {icon}
    </div>
    <p className="text-sm font-medium text-textMuted mb-1">{title}</p>
    <p className="text-xs text-textMuted/60 text-center">{description}</p>
  </div>
)

export const MediaSidesheet: React.FC = () => {
  const { vaultPath } = useVaultStore()
  const { activeNotebook } = useNotebookStore()
  const { isMediaSheetOpen, closeMediaSheet } = useUIStore()
  const [activeTab, setActiveTab] = useState<MediaTab>('images')
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load all notes when the sidesheet opens
  useEffect(() => {
    if (!isMediaSheetOpen || !vaultPath || !activeNotebook) {
      // Clear notes when sidesheet closes to free memory
      if (!isMediaSheetOpen) {
        setAllNotes([])
      }
      return
    }

    const loadAllNotes = async () => {
      setIsLoading(true)
      try {
        const notes = await getAllNotesFromNotebook(vaultPath, activeNotebook)
        setAllNotes(notes)
      } catch (error) {
        console.error('Failed to load notes for media:', error)
        setAllNotes([])
      } finally {
        setIsLoading(false)
      }
    }

    loadAllNotes()
  }, [isMediaSheetOpen, vaultPath, activeNotebook])

  // Reset to images tab when opening or switching notebooks
  useEffect(() => {
    if (isMediaSheetOpen) {
      setActiveTab('images')
    }
  }, [activeNotebook, isMediaSheetOpen])

  // Extract all media from notes
  const { images, links, files } = useMemo(() => {
    const images: ExtractedImage[] = []
    const links: ExtractedLink[] = []
    const files: ExtractedFile[] = []

    for (const note of allNotes) {
      // Extract images
      images.push(...extractImages(note.content, note.filename, note.createdAt))
      
      // Extract links (already available in note.urls)
      for (const url of note.urls) {
        links.push({
          url,
          noteFilename: note.filename,
          noteDate: note.createdAt
        })
      }

      // Extract file links
      files.push(...extractFiles(note.content, note.filename, note.createdAt))
    }

    // Sort by date (newest first)
    images.sort((a, b) => b.noteDate - a.noteDate)
    links.sort((a, b) => b.noteDate - a.noteDate)
    files.sort((a, b) => b.noteDate - a.noteDate)

    return { images, links, files }
  }, [allNotes])

  if (!isMediaSheetOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={closeMediaSheet}
      />
      
      {/* Sidesheet */}
      <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-surface border-l border-border/50 z-50 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
        {/* Header */}
        <div className="h-14 border-b border-border/40 flex items-center justify-between px-4 shrink-0">
          <h2 className="font-semibold text-textMain">Media & Links</h2>
          <button
            onClick={closeMediaSheet}
            className="p-2 rounded-lg text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 bg-black/20">
          <TabButton
            active={activeTab === 'images'}
            onClick={() => setActiveTab('images')}
            icon={<Image size={14} />}
            label="Images"
            count={images.length}
          />
          <TabButton
            active={activeTab === 'links'}
            onClick={() => setActiveTab('links')}
            icon={<Link2 size={14} />}
            label="Links"
            count={links.length}
          />
          <TabButton
            active={activeTab === 'files'}
            onClick={() => setActiveTab('files')}
            icon={<FileText size={14} />}
            label="Files"
            count={files.length}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={24} className="text-brand animate-spin mb-3" />
              <p className="text-sm text-textMuted">Loading media...</p>
            </div>
          ) : (
            <>
              {activeTab === 'images' && (
                images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((image, idx) => (
                      <ImageCard key={`${image.noteFilename}-${idx}`} image={image} vaultPath={vaultPath || ''} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Image size={24} />}
                    title="No images yet"
                    description="Images from your notes will appear here"
                  />
                )
              )}

              {activeTab === 'links' && (
                links.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {links.map((link, idx) => (
                      <LinkCard key={`${link.noteFilename}-${idx}`} link={link} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Link2 size={24} />}
                    title="No links yet"
                    description="Links from your notes will appear here"
                  />
                )
              )}

              {activeTab === 'files' && (
                files.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {files.map((file, idx) => (
                      <FileCard key={`${file.noteFilename}-${idx}`} file={file} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText size={24} />}
                    title="No files yet"
                    description="File attachments from your notes will appear here"
                  />
                )
              )}
            </>
          )}
        </div>

        {/* Footer stats */}
        <div className="h-10 border-t border-border/30 flex items-center justify-center px-4 bg-black/20">
          <span className="text-[11px] text-textMuted/50">
            {images.length} images · {links.length} links · {files.length} files
          </span>
        </div>
      </div>
    </>
  )
}

