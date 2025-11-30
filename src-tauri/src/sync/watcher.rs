//! File system watcher for detecting local changes

#![allow(dead_code)]

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::{Mutex, RwLock};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

use super::error::{SyncError, SyncResult};
use super::types::ChangeOperation;

/// Represents a detected file change
#[derive(Debug, Clone)]
pub struct FileChange {
    pub vault_path: String,
    pub relative_path: String,
    pub operation: ChangeOperation,
}

/// File system watcher for vault directories
pub struct VaultWatcher {
    /// Active watchers for each vault
    watchers: Arc<RwLock<Vec<WatcherHandle>>>,
    /// Channel sender for file changes
    tx: Sender<FileChange>,
    /// Channel receiver for file changes (uses Mutex since Receiver isn't Sync)
    rx: Arc<Mutex<Option<Receiver<FileChange>>>>,
    /// Paths to ignore (e.g., .sync-conflict files during resolution)
    ignored_paths: Arc<RwLock<HashSet<PathBuf>>>,
}

struct WatcherHandle {
    vault_path: PathBuf,
    _watcher: RecommendedWatcher,
}

impl VaultWatcher {
    /// Create a new vault watcher
    pub fn new() -> Self {
        let (tx, rx) = channel();
        Self {
            watchers: Arc::new(RwLock::new(Vec::new())),
            tx,
            rx: Arc::new(Mutex::new(Some(rx))),
            ignored_paths: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    /// Start watching a vault directory
    pub fn watch(&self, vault_path: &Path) -> SyncResult<()> {
        let vault_path_buf = vault_path.to_path_buf();
        let tx = self.tx.clone();
        let ignored = Arc::clone(&self.ignored_paths);

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    if let Some(change) = Self::process_event(&vault_path_buf, event, &ignored) {
                        let _ = tx.send(change);
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {:?}", e);
                }
            }
        }).map_err(|e| SyncError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to create watcher: {}", e),
        )))?;

        watcher
            .watch(vault_path, RecursiveMode::Recursive)
            .map_err(|e| SyncError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to watch path: {}", e),
            )))?;

        self.watchers.write().push(WatcherHandle {
            vault_path: vault_path.to_path_buf(),
            _watcher: watcher,
        });

        Ok(())
    }

    /// Stop watching a vault directory
    pub fn unwatch(&self, vault_path: &Path) {
        let mut watchers = self.watchers.write();
        watchers.retain(|w| w.vault_path != vault_path);
    }

    /// Process a file system event
    fn process_event(
        vault_path: &Path,
        event: Event,
        ignored: &Arc<RwLock<HashSet<PathBuf>>>,
    ) -> Option<FileChange> {
        // Only process file changes, not directory changes
        let path = event.paths.first()?;
        
        // Skip directories
        if path.is_dir() {
            return None;
        }

        // Skip ignored paths
        if ignored.read().contains(path) {
            return None;
        }

        // Skip non-markdown files (unless in attachments folder)
        let relative = path.strip_prefix(vault_path).ok()?;
        let relative_str = relative.to_string_lossy().to_string().replace('\\', "/");

        // Skip hidden files and directories
        if relative_str.starts_with('.') || relative_str.contains("/.") {
            return None;
        }

        // Only sync .md files and attachments
        let is_attachment = relative_str.starts_with("attachments/");
        let is_markdown = path.extension().map_or(false, |ext| ext == "md");
        
        if !is_markdown && !is_attachment {
            return None;
        }

        let operation = match event.kind {
            EventKind::Create(_) => ChangeOperation::Create,
            EventKind::Modify(_) => ChangeOperation::Update,
            EventKind::Remove(_) => ChangeOperation::Delete,
            _ => return None,
        };

        Some(FileChange {
            vault_path: vault_path.to_string_lossy().to_string(),
            relative_path: relative_str,
            operation,
        })
    }

    /// Take the receiver (can only be done once)
    pub fn take_receiver(&self) -> Option<Receiver<FileChange>> {
        self.rx.lock().take()
    }

    /// Add a path to the ignore list
    pub fn ignore_path(&self, path: &Path) {
        self.ignored_paths.write().insert(path.to_path_buf());
    }

    /// Remove a path from the ignore list
    pub fn unignore_path(&self, path: &Path) {
        self.ignored_paths.write().remove(path);
    }

    /// Clear all ignored paths
    pub fn clear_ignored(&self) {
        self.ignored_paths.write().clear();
    }

    /// Check if any vaults are being watched
    pub fn is_watching(&self) -> bool {
        !self.watchers.read().is_empty()
    }

    /// Get list of watched vault paths
    pub fn watched_vaults(&self) -> Vec<PathBuf> {
        self.watchers.read()
            .iter()
            .map(|w| w.vault_path.clone())
            .collect()
    }
}

impl Default for VaultWatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Debouncer for file changes (batch rapid changes)
pub struct ChangeDebouncer {
    pending: Arc<RwLock<Vec<FileChange>>>,
    debounce_ms: u64,
}

impl ChangeDebouncer {
    /// Create a new debouncer
    pub fn new(debounce_ms: u64) -> Self {
        Self {
            pending: Arc::new(RwLock::new(Vec::new())),
            debounce_ms,
        }
    }

    /// Add a change to the pending list
    pub fn add(&self, change: FileChange) {
        let mut pending = self.pending.write();
        
        // If we already have a change for this file, update the operation
        if let Some(existing) = pending.iter_mut().find(|c| {
            c.vault_path == change.vault_path && c.relative_path == change.relative_path
        }) {
            // Upgrade operation: create -> update stays create, update -> delete becomes delete
            match (&existing.operation, &change.operation) {
                (ChangeOperation::Create, ChangeOperation::Update) => {
                    // Keep as create
                }
                (ChangeOperation::Create, ChangeOperation::Delete) => {
                    // File created then deleted, remove from pending
                    pending.retain(|c| {
                        !(c.vault_path == change.vault_path && c.relative_path == change.relative_path)
                    });
                    return;
                }
                _ => {
                    existing.operation = change.operation;
                }
            }
        } else {
            pending.push(change);
        }
    }

    /// Take all pending changes
    pub fn take(&self) -> Vec<FileChange> {
        std::mem::take(&mut *self.pending.write())
    }

    /// Check if there are pending changes
    pub fn has_pending(&self) -> bool {
        !self.pending.read().is_empty()
    }

    /// Get count of pending changes
    pub fn pending_count(&self) -> usize {
        self.pending.read().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debouncer_coalesces_updates() {
        let debouncer = ChangeDebouncer::new(100);

        debouncer.add(FileChange {
            vault_path: "/vault".to_string(),
            relative_path: "test.md".to_string(),
            operation: ChangeOperation::Update,
        });

        debouncer.add(FileChange {
            vault_path: "/vault".to_string(),
            relative_path: "test.md".to_string(),
            operation: ChangeOperation::Update,
        });

        let changes = debouncer.take();
        assert_eq!(changes.len(), 1);
    }

    #[test]
    fn test_debouncer_create_delete_cancels() {
        let debouncer = ChangeDebouncer::new(100);

        debouncer.add(FileChange {
            vault_path: "/vault".to_string(),
            relative_path: "test.md".to_string(),
            operation: ChangeOperation::Create,
        });

        debouncer.add(FileChange {
            vault_path: "/vault".to_string(),
            relative_path: "test.md".to_string(),
            operation: ChangeOperation::Delete,
        });

        let changes = debouncer.take();
        assert_eq!(changes.len(), 0);
    }
}

