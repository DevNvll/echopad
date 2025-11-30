//! File scanner for detecting local changes

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

use blake3::Hasher;
use serde::{Deserialize, Serialize};

use super::error::{SyncError, SyncResult};

/// Information about a single file in the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    /// Relative path from vault root
    pub relative_path: String,
    /// BLAKE3 hash of file content
    pub content_hash: String,
    /// File size in bytes
    pub size_bytes: u64,
    /// Last modification time (Unix timestamp ms)
    pub modified_at: u64,
}

/// Result of scanning a vault
#[derive(Debug, Clone)]
pub struct ScanResult {
    /// All files found in the vault
    pub files: HashMap<String, FileInfo>,
    /// Total size of all files
    pub total_size: u64,
    /// Number of files scanned
    pub file_count: usize,
}

/// File extensions to sync (markdown and common attachments)
const SYNC_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "json", "yaml",
    "yml", "toml",
];

/// Directories to skip
const SKIP_DIRS: &[&str] = &[".git", ".obsidian", ".trash", "node_modules", ".sync"];

/// Scan a vault directory and return information about all syncable files
pub fn scan_vault(vault_path: &Path) -> SyncResult<ScanResult> {
    let mut files = HashMap::new();
    let mut total_size = 0u64;

    scan_directory(vault_path, vault_path, &mut files, &mut total_size)?;

    Ok(ScanResult {
        file_count: files.len(),
        files,
        total_size,
    })
}

fn scan_directory(
    root: &Path,
    current: &Path,
    files: &mut HashMap<String, FileInfo>,
    total_size: &mut u64,
) -> SyncResult<()> {
    let entries = fs::read_dir(current).map_err(|e| {
        SyncError::Io(std::io::Error::new(
            e.kind(),
            format!("Failed to read directory {:?}: {}", current, e),
        ))
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| SyncError::Io(e))?;
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        // Skip hidden files and directories (except .md files)
        if file_name_str.starts_with('.') && !file_name_str.ends_with(".md") {
            continue;
        }

        if path.is_dir() {
            // Skip certain directories
            if SKIP_DIRS.contains(&file_name_str.as_ref()) {
                continue;
            }
            scan_directory(root, &path, files, total_size)?;
        } else if path.is_file() {
            // Check if file extension should be synced
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if !SYNC_EXTENSIONS.contains(&ext_str.as_str()) {
                    continue;
                }
            } else {
                // Skip files without extensions
                continue;
            }

            // Get file info
            match get_file_info(root, &path) {
                Ok(file_info) => {
                    *total_size += file_info.size_bytes;
                    files.insert(file_info.relative_path.clone(), file_info);
                }
                Err(e) => {
                    eprintln!("[Scanner] Failed to read file {:?}: {}", path, e);
                }
            }
        }
    }

    Ok(())
}

/// Get information about a single file
fn get_file_info(root: &Path, path: &Path) -> SyncResult<FileInfo> {
    let metadata = fs::metadata(path).map_err(SyncError::Io)?;

    let relative_path = path
        .strip_prefix(root)
        .map_err(|_| SyncError::InvalidData("Failed to get relative path".to_string()))?
        .to_string_lossy()
        .replace('\\', "/"); // Normalize path separators

    let content = fs::read(path).map_err(SyncError::Io)?;
    let content_hash = compute_hash(&content);

    let modified_at = metadata
        .modified()
        .map_err(SyncError::Io)?
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(FileInfo {
        relative_path,
        content_hash,
        size_bytes: metadata.len(),
        modified_at,
    })
}

/// Compute BLAKE3 hash of content and return as hex string
pub fn compute_hash(content: &[u8]) -> String {
    let mut hasher = Hasher::new();
    hasher.update(content);
    hasher.finalize().to_hex().to_string()
}

/// Compare local scan with previous state to find changes
#[derive(Debug, Clone)]
pub struct ChangeSet {
    /// Files that are new or modified
    pub changed: Vec<FileInfo>,
    /// Files that were deleted (relative paths)
    pub deleted: Vec<String>,
}

/// Detect changes between current scan and previous state
pub fn detect_changes(
    current: &ScanResult,
    previous: &HashMap<String, String>, // path -> hash
) -> ChangeSet {
    let mut changed = Vec::new();
    let mut deleted = Vec::new();

    // Find new and modified files
    for (path, info) in &current.files {
        match previous.get(path) {
            Some(prev_hash) if prev_hash == &info.content_hash => {
                // File unchanged
            }
            _ => {
                // New or modified
                changed.push(info.clone());
            }
        }
    }

    // Find deleted files
    for path in previous.keys() {
        if !current.files.contains_key(path) {
            deleted.push(path.clone());
        }
    }

    ChangeSet { changed, deleted }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_hash() {
        let content = b"Hello, World!";
        let hash = compute_hash(content);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // BLAKE3 produces 256-bit hash = 64 hex chars
    }

    #[test]
    fn test_detect_changes() {
        let mut files = HashMap::new();
        files.insert(
            "test.md".to_string(),
            FileInfo {
                relative_path: "test.md".to_string(),
                content_hash: "abc123".to_string(),
                size_bytes: 100,
                modified_at: 1000,
            },
        );
        files.insert(
            "new.md".to_string(),
            FileInfo {
                relative_path: "new.md".to_string(),
                content_hash: "def456".to_string(),
                size_bytes: 50,
                modified_at: 2000,
            },
        );

        let current = ScanResult {
            files,
            total_size: 150,
            file_count: 2,
        };

        let mut previous = HashMap::new();
        previous.insert("test.md".to_string(), "abc123".to_string()); // Same hash
        previous.insert("deleted.md".to_string(), "xyz789".to_string()); // Will be detected as deleted

        let changes = detect_changes(&current, &previous);
        assert_eq!(changes.changed.len(), 1); // Only "new.md" is new
        assert_eq!(changes.deleted.len(), 1); // "deleted.md" was removed
        assert_eq!(changes.deleted[0], "deleted.md");
    }
}
