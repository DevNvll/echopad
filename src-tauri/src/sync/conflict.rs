//! Conflict detection and resolution

#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::fs;

use super::error::{SyncError, SyncResult};
use super::types::ConflictInfo;

/// Conflict file suffix pattern
const CONFLICT_SUFFIX: &str = ".sync-conflict-";

/// Conflict manager for handling sync conflicts
pub struct ConflictManager {
    /// Device identifier for conflict naming
    device_id: String,
}

impl ConflictManager {
    /// Create a new conflict manager
    pub fn new(device_id: String) -> Self {
        Self { device_id }
    }

    /// Generate a conflict file path
    pub fn generate_conflict_path(&self, original_path: &Path) -> PathBuf {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let stem = original_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let ext = original_path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        let device_short = self.device_id
            .chars()
            .take(8)
            .collect::<String>();

        let conflict_name = format!(
            "{}{}{}{}{}",
            stem,
            CONFLICT_SUFFIX,
            device_short,
            timestamp,
            ext
        );

        original_path.with_file_name(conflict_name)
    }

    /// Check if a path is a conflict file
    pub fn is_conflict_file(path: &Path) -> bool {
        path.file_name()
            .map(|name| name.to_string_lossy().contains(CONFLICT_SUFFIX))
            .unwrap_or(false)
    }

    /// Get the original path from a conflict path
    pub fn get_original_path(conflict_path: &Path) -> Option<PathBuf> {
        let name = conflict_path.file_name()?.to_string_lossy();
        
        if let Some(idx) = name.find(CONFLICT_SUFFIX) {
            let original_stem = &name[..idx];
            
            // Find the extension (after the timestamp)
            let ext = conflict_path.extension()
                .map(|e| format!(".{}", e.to_string_lossy()))
                .unwrap_or_default();
            
            let original_name = format!("{}{}", original_stem, ext);
            Some(conflict_path.with_file_name(original_name))
        } else {
            None
        }
    }

    /// Create a conflict file from content
    pub fn create_conflict_file(
        &self,
        vault_path: &Path,
        relative_path: &str,
        content: &[u8],
    ) -> SyncResult<PathBuf> {
        let original_path = vault_path.join(relative_path);
        let conflict_path = self.generate_conflict_path(&original_path);

        fs::write(&conflict_path, content)?;

        Ok(conflict_path)
    }

    /// List all conflict files in a vault
    pub fn list_conflicts(&self, vault_path: &Path) -> SyncResult<Vec<ConflictInfo>> {
        let mut conflicts = Vec::new();
        self.scan_conflicts_recursive(vault_path, vault_path, &mut conflicts)?;
        Ok(conflicts)
    }

    fn scan_conflicts_recursive(
        &self,
        base_path: &Path,
        current_path: &Path,
        conflicts: &mut Vec<ConflictInfo>,
    ) -> SyncResult<()> {
        if !current_path.is_dir() {
            return Ok(());
        }

        for entry in fs::read_dir(current_path)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // Skip hidden directories
                if !path.file_name()
                    .map(|n| n.to_string_lossy().starts_with('.'))
                    .unwrap_or(false)
                {
                    self.scan_conflicts_recursive(base_path, &path, conflicts)?;
                }
            } else if Self::is_conflict_file(&path) {
                if let Some(info) = self.parse_conflict_info(base_path, &path)? {
                    conflicts.push(info);
                }
            }
        }

        Ok(())
    }

    fn parse_conflict_info(
        &self,
        base_path: &Path,
        conflict_path: &Path,
    ) -> SyncResult<Option<ConflictInfo>> {
        let original_path = match Self::get_original_path(conflict_path) {
            Some(p) => p,
            None => return Ok(None),
        };

        let relative_conflict = conflict_path
            .strip_prefix(base_path)
            .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
            .unwrap_or_default();

        let relative_original = original_path
            .strip_prefix(base_path)
            .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
            .unwrap_or_default();

        // Get modification times
        let conflict_modified = fs::metadata(conflict_path)
            .and_then(|m| m.modified())
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64)
            .unwrap_or(0);

        let original_modified = if original_path.exists() {
            fs::metadata(&original_path)
                .and_then(|m| m.modified())
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64)
                .unwrap_or(0)
        } else {
            0
        };

        // Extract timestamp from conflict filename
        let name = conflict_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let created_at = if let Some(idx) = name.rfind(CONFLICT_SUFFIX) {
            let after_suffix = &name[idx + CONFLICT_SUFFIX.len()..];
            // Skip device ID (8 chars) and parse timestamp
            if after_suffix.len() > 8 {
                let timestamp_str = &after_suffix[8..];
                // Find where the extension starts
                let timestamp_end = timestamp_str.find('.').unwrap_or(timestamp_str.len());
                timestamp_str[..timestamp_end].parse::<u64>().unwrap_or(0) * 1000
            } else {
                0
            }
        } else {
            0
        };

        Ok(Some(ConflictInfo {
            original_path: relative_original,
            conflict_path: relative_conflict,
            local_modified_at: original_modified,
            remote_modified_at: conflict_modified,
            created_at,
        }))
    }

    /// Resolve a conflict by keeping one version
    pub fn resolve_conflict(
        &self,
        vault_path: &Path,
        conflict_relative_path: &str,
        keep: ConflictResolution,
    ) -> SyncResult<()> {
        let conflict_path = vault_path.join(conflict_relative_path);
        
        if !conflict_path.exists() {
            return Err(SyncError::FileNotFound(conflict_relative_path.to_string()));
        }

        let original_path = Self::get_original_path(&conflict_path)
            .ok_or_else(|| SyncError::InvalidState("Not a conflict file".to_string()))?;

        match keep {
            ConflictResolution::KeepLocal => {
                // Delete conflict file, keep original
                fs::remove_file(&conflict_path)?;
            }
            ConflictResolution::KeepRemote => {
                // Replace original with conflict, delete conflict
                if conflict_path.exists() {
                    fs::copy(&conflict_path, &original_path)?;
                    fs::remove_file(&conflict_path)?;
                }
            }
            ConflictResolution::KeepBoth => {
                // Rename conflict to a non-conflict name
                let stem = original_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let ext = original_path
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy()))
                    .unwrap_or_default();
                
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                
                let new_name = format!("{} (copy {}){}", stem, timestamp, ext);
                let new_path = original_path.with_file_name(new_name);
                
                fs::rename(&conflict_path, &new_path)?;
            }
        }

        Ok(())
    }

    /// Delete all conflict files for a specific original path
    pub fn delete_conflicts_for(&self, vault_path: &Path, original_relative_path: &str) -> SyncResult<u32> {
        let conflicts = self.list_conflicts(vault_path)?;
        let mut deleted = 0;

        for conflict in conflicts {
            if conflict.original_path == original_relative_path {
                let conflict_full_path = vault_path.join(&conflict.conflict_path);
                if conflict_full_path.exists() {
                    fs::remove_file(&conflict_full_path)?;
                    deleted += 1;
                }
            }
        }

        Ok(deleted)
    }
}

/// Conflict resolution choice
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConflictResolution {
    /// Keep the local version, discard remote
    KeepLocal,
    /// Keep the remote version, discard local
    KeepRemote,
    /// Keep both versions (rename conflict file)
    KeepBoth,
}

impl std::str::FromStr for ConflictResolution {
    type Err = SyncError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "local" | "keep_local" | "keeplocal" => Ok(ConflictResolution::KeepLocal),
            "remote" | "keep_remote" | "keepremote" => Ok(ConflictResolution::KeepRemote),
            "both" | "keep_both" | "keepboth" => Ok(ConflictResolution::KeepBoth),
            _ => Err(SyncError::InvalidState(format!("Unknown resolution: {}", s))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_is_conflict_file() {
        assert!(ConflictManager::is_conflict_file(Path::new("test.sync-conflict-abc123451234567890.md")));
        assert!(!ConflictManager::is_conflict_file(Path::new("test.md")));
        assert!(!ConflictManager::is_conflict_file(Path::new("test.sync-other.md")));
    }

    #[test]
    fn test_conflict_path_generation() {
        let manager = ConflictManager::new("device123".to_string());
        let original = PathBuf::from("/vault/notes/test.md");
        let conflict = manager.generate_conflict_path(&original);
        
        let name = conflict.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with("test.sync-conflict-"));
        assert!(name.ends_with(".md"));
    }

    #[test]
    fn test_get_original_path() {
        let conflict = PathBuf::from("/vault/test.sync-conflict-abc123451234567890.md");
        let original = ConflictManager::get_original_path(&conflict);
        
        assert!(original.is_some());
        assert_eq!(original.unwrap().file_name().unwrap().to_string_lossy(), "test.md");
    }
}

