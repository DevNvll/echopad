//! Upload and download queue management

#![allow(dead_code)]

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;

use super::types::ChangeOperation;

/// Queue item representing a pending sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: String,
    pub vault_path: String,
    pub relative_path: String,
    pub operation: QueueOperation,
    pub created_at: u64,
    pub attempts: u32,
    pub last_attempt_at: Option<u64>,
    pub last_error: Option<String>,
    pub priority: Priority,
}

/// Queue operation type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum QueueOperation {
    Upload,
    Download,
    Delete,
}

impl From<ChangeOperation> for QueueOperation {
    fn from(op: ChangeOperation) -> Self {
        match op {
            ChangeOperation::Create | ChangeOperation::Update => QueueOperation::Upload,
            ChangeOperation::Delete => QueueOperation::Delete,
        }
    }
}

/// Priority levels for queue items
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for Priority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Sync queue for managing pending operations
pub struct SyncQueue {
    /// Upload queue
    upload_queue: Arc<RwLock<VecDeque<QueueItem>>>,
    /// Download queue
    download_queue: Arc<RwLock<VecDeque<QueueItem>>>,
    /// Maximum retry attempts
    max_retries: u32,
    /// Base retry delay in milliseconds
    retry_delay_ms: u64,
}

impl SyncQueue {
    /// Create a new sync queue
    pub fn new() -> Self {
        Self {
            upload_queue: Arc::new(RwLock::new(VecDeque::new())),
            download_queue: Arc::new(RwLock::new(VecDeque::new())),
            max_retries: 5,
            retry_delay_ms: 1000,
        }
    }

    /// Create a queue with custom settings
    pub fn with_config(max_retries: u32, retry_delay_ms: u64) -> Self {
        Self {
            upload_queue: Arc::new(RwLock::new(VecDeque::new())),
            download_queue: Arc::new(RwLock::new(VecDeque::new())),
            max_retries,
            retry_delay_ms,
        }
    }

    /// Add an item to the upload queue
    pub fn enqueue_upload(&self, item: QueueItem) {
        let mut queue = self.upload_queue.write();
        
        // Remove existing item for same path if present
        queue.retain(|i| {
            !(i.vault_path == item.vault_path && i.relative_path == item.relative_path)
        });

        // Insert based on priority
        let pos = queue.iter().position(|i| i.priority < item.priority)
            .unwrap_or(queue.len());
        queue.insert(pos, item);
    }

    /// Add an item to the download queue
    pub fn enqueue_download(&self, item: QueueItem) {
        let mut queue = self.download_queue.write();
        
        // Remove existing item for same path if present
        queue.retain(|i| {
            !(i.vault_path == item.vault_path && i.relative_path == item.relative_path)
        });

        // Insert based on priority
        let pos = queue.iter().position(|i| i.priority < item.priority)
            .unwrap_or(queue.len());
        queue.insert(pos, item);
    }

    /// Get the next upload item ready for processing
    pub fn next_upload(&self) -> Option<QueueItem> {
        let queue = self.upload_queue.read();
        let now = Self::now();

        queue.iter()
            .find(|item| self.is_ready(item, now))
            .cloned()
    }

    /// Get the next download item ready for processing
    pub fn next_download(&self) -> Option<QueueItem> {
        let queue = self.download_queue.read();
        let now = Self::now();

        queue.iter()
            .find(|item| self.is_ready(item, now))
            .cloned()
    }

    /// Check if an item is ready for processing (respects backoff)
    fn is_ready(&self, item: &QueueItem, now: u64) -> bool {
        if item.attempts >= self.max_retries {
            return false;
        }

        match item.last_attempt_at {
            Some(last) => {
                let backoff = self.calculate_backoff(item.attempts);
                now >= last + backoff
            }
            None => true,
        }
    }

    /// Calculate exponential backoff delay
    fn calculate_backoff(&self, attempts: u32) -> u64 {
        self.retry_delay_ms * 2u64.pow(attempts.min(10))
    }

    /// Mark an upload as completed
    pub fn complete_upload(&self, id: &str) {
        self.upload_queue.write().retain(|i| i.id != id);
    }

    /// Mark a download as completed
    pub fn complete_download(&self, id: &str) {
        self.download_queue.write().retain(|i| i.id != id);
    }

    /// Mark an upload as failed
    pub fn fail_upload(&self, id: &str, error: &str) {
        let mut queue = self.upload_queue.write();
        if let Some(item) = queue.iter_mut().find(|i| i.id == id) {
            item.attempts += 1;
            item.last_attempt_at = Some(Self::now());
            item.last_error = Some(error.to_string());
        }
    }

    /// Mark a download as failed
    pub fn fail_download(&self, id: &str, error: &str) {
        let mut queue = self.download_queue.write();
        if let Some(item) = queue.iter_mut().find(|i| i.id == id) {
            item.attempts += 1;
            item.last_attempt_at = Some(Self::now());
            item.last_error = Some(error.to_string());
        }
    }

    /// Remove an item from the upload queue
    pub fn remove_upload(&self, id: &str) {
        self.upload_queue.write().retain(|i| i.id != id);
    }

    /// Remove an item from the download queue
    pub fn remove_download(&self, id: &str) {
        self.download_queue.write().retain(|i| i.id != id);
    }

    /// Get all pending uploads for a vault
    pub fn pending_uploads(&self, vault_path: &str) -> Vec<QueueItem> {
        self.upload_queue.read()
            .iter()
            .filter(|i| i.vault_path == vault_path)
            .cloned()
            .collect()
    }

    /// Get all pending downloads for a vault
    pub fn pending_downloads(&self, vault_path: &str) -> Vec<QueueItem> {
        self.download_queue.read()
            .iter()
            .filter(|i| i.vault_path == vault_path)
            .cloned()
            .collect()
    }

    /// Get total pending upload count
    pub fn upload_count(&self) -> usize {
        self.upload_queue.read().len()
    }

    /// Get total pending download count
    pub fn download_count(&self) -> usize {
        self.download_queue.read().len()
    }

    /// Get failed items (exceeded max retries)
    pub fn failed_items(&self) -> Vec<QueueItem> {
        let mut failed = Vec::new();

        for item in self.upload_queue.read().iter() {
            if item.attempts >= self.max_retries {
                failed.push(item.clone());
            }
        }

        for item in self.download_queue.read().iter() {
            if item.attempts >= self.max_retries {
                failed.push(item.clone());
            }
        }

        failed
    }

    /// Clear all items for a vault
    pub fn clear_vault(&self, vault_path: &str) {
        self.upload_queue.write().retain(|i| i.vault_path != vault_path);
        self.download_queue.write().retain(|i| i.vault_path != vault_path);
    }

    /// Clear all queues
    pub fn clear_all(&self) {
        self.upload_queue.write().clear();
        self.download_queue.write().clear();
    }

    /// Retry failed items
    pub fn retry_failed(&self) {
        let now = Self::now();

        {
            let mut queue = self.upload_queue.write();
            for item in queue.iter_mut() {
                if item.attempts >= self.max_retries {
                    item.attempts = 0;
                    item.last_attempt_at = None;
                    item.last_error = None;
                }
            }
        }

        {
            let mut queue = self.download_queue.write();
            for item in queue.iter_mut() {
                if item.attempts >= self.max_retries {
                    item.attempts = 0;
                    item.last_attempt_at = None;
                    item.last_error = None;
                }
            }
        }
    }

    fn now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Default for SyncQueue {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for SyncQueue {
    fn clone(&self) -> Self {
        Self {
            upload_queue: Arc::clone(&self.upload_queue),
            download_queue: Arc::clone(&self.download_queue),
            max_retries: self.max_retries,
            retry_delay_ms: self.retry_delay_ms,
        }
    }
}

/// Helper to create queue items
impl QueueItem {
    pub fn new_upload(vault_path: String, relative_path: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            vault_path,
            relative_path,
            operation: QueueOperation::Upload,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            attempts: 0,
            last_attempt_at: None,
            last_error: None,
            priority: Priority::Normal,
        }
    }

    pub fn new_download(vault_path: String, relative_path: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            vault_path,
            relative_path,
            operation: QueueOperation::Download,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            attempts: 0,
            last_attempt_at: None,
            last_error: None,
            priority: Priority::Normal,
        }
    }

    pub fn new_delete(vault_path: String, relative_path: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            vault_path,
            relative_path,
            operation: QueueOperation::Delete,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            attempts: 0,
            last_attempt_at: None,
            last_error: None,
            priority: Priority::Normal,
        }
    }

    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_queue_operations() {
        let queue = SyncQueue::new();

        let item = QueueItem::new_upload("/vault".to_string(), "test.md".to_string());
        let id = item.id.clone();
        
        queue.enqueue_upload(item);
        assert_eq!(queue.upload_count(), 1);

        let next = queue.next_upload();
        assert!(next.is_some());
        assert_eq!(next.unwrap().id, id);

        queue.complete_upload(&id);
        assert_eq!(queue.upload_count(), 0);
    }

    #[test]
    fn test_priority_ordering() {
        let queue = SyncQueue::new();

        let low = QueueItem::new_upload("/vault".to_string(), "low.md".to_string())
            .with_priority(Priority::Low);
        let high = QueueItem::new_upload("/vault".to_string(), "high.md".to_string())
            .with_priority(Priority::High);

        queue.enqueue_upload(low);
        queue.enqueue_upload(high);

        let next = queue.next_upload().unwrap();
        assert_eq!(next.relative_path, "high.md");
    }

    #[test]
    fn test_deduplication() {
        let queue = SyncQueue::new();

        queue.enqueue_upload(QueueItem::new_upload("/vault".to_string(), "test.md".to_string()));
        queue.enqueue_upload(QueueItem::new_upload("/vault".to_string(), "test.md".to_string()));

        assert_eq!(queue.upload_count(), 1);
    }
}

