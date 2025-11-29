use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Notebook {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<Notebook>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteFile {
    pub filename: String,
    pub content: String,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub filename: String,
    pub created_at: u64,
}

fn scan_notebooks_recursive(dir_path: &PathBuf, vault_path: &PathBuf) -> Result<Vec<Notebook>, String> {
    let mut notebooks = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if let Some(name) = entry_path.file_name() {
                let name_str = name.to_string_lossy().to_string();
                if !name_str.starts_with('.') && name_str != "attachments" {
                    let relative_path = entry_path
                        .strip_prefix(vault_path)
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                        .to_string()
                        .replace('\\', "/");
                    
                    let children = scan_notebooks_recursive(&entry_path, vault_path)?;
                    let children_opt = if children.is_empty() { None } else { Some(children) };
                    
                    notebooks.push(Notebook {
                        name: name_str,
                        path: entry_path.to_string_lossy().to_string(),
                        relative_path,
                        children: children_opt,
                    });
                }
            }
        }
    }

    notebooks.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(notebooks)
}

#[tauri::command]
fn list_notebooks(vault_path: String) -> Result<Vec<Notebook>, String> {
    let path = PathBuf::from(&vault_path);
    if !path.exists() {
        return Err("Vault path does not exist".to_string());
    }

    scan_notebooks_recursive(&path, &path)
}

#[tauri::command]
fn create_notebook(vault_path: String, name: String, parent_path: Option<String>) -> Result<Notebook, String> {
    let vault = PathBuf::from(&vault_path);
    let path = match &parent_path {
        Some(parent) => vault.join(parent).join(&name),
        None => vault.join(&name),
    };
    
    if path.exists() {
        return Err("Notebook already exists".to_string());
    }

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let relative_path = path
        .strip_prefix(&vault)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string()
        .replace('\\', "/");

    Ok(Notebook {
        name,
        path: path.to_string_lossy().to_string(),
        relative_path,
        children: None,
    })
}

#[tauri::command]
fn rename_notebook(vault_path: String, old_relative_path: String, new_name: String) -> Result<Notebook, String> {
    let vault = PathBuf::from(&vault_path);
    let old_path = vault.join(&old_relative_path);
    
    let parent_dir = old_path.parent().unwrap_or(&vault);
    let new_path = parent_dir.join(&new_name);

    if !old_path.exists() {
        return Err("Notebook does not exist".to_string());
    }
    if new_path.exists() {
        return Err("A notebook with that name already exists".to_string());
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    let relative_path = new_path
        .strip_prefix(&vault)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string()
        .replace('\\', "/");

    Ok(Notebook {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
        relative_path,
        children: None,
    })
}

#[tauri::command]
fn delete_notebook(vault_path: String, relative_path: String) -> Result<(), String> {
    let path = PathBuf::from(&vault_path).join(&relative_path);
    if !path.exists() {
        return Err("Notebook does not exist".to_string());
    }

    fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_notes(vault_path: String, notebook_path: String) -> Result<Vec<NoteMetadata>, String> {
    let path = PathBuf::from(&vault_path).join(&notebook_path);
    if !path.exists() {
        return Err("Notebook does not exist".to_string());
    }

    let mut notes = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_file() {
            if let Some(ext) = entry_path.extension() {
                if ext == "md" {
                    if let Some(filename) = entry_path.file_name() {
                        let filename_str = filename.to_string_lossy().to_string();
                        let stem = entry_path.file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let created_at = stem.parse::<u64>().unwrap_or(0);
                        notes.push(NoteMetadata {
                            filename: filename_str,
                            created_at,
                        });
                    }
                }
            }
        }
    }

    notes.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(notes)
}

#[tauri::command]
fn read_note(vault_path: String, notebook_path: String, filename: String) -> Result<NoteFile, String> {
    let path = PathBuf::from(&vault_path).join(&notebook_path).join(&filename);
    if !path.exists() {
        return Err("Note does not exist".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let stem = path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let created_at = stem.parse::<u64>().unwrap_or(0);

    Ok(NoteFile {
        filename,
        content,
        created_at,
    })
}

#[tauri::command]
fn create_note(vault_path: String, notebook_path: String, content: String) -> Result<NoteFile, String> {
    let full_notebook_path = PathBuf::from(&vault_path).join(&notebook_path);
    if !full_notebook_path.exists() {
        return Err("Notebook does not exist".to_string());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    let filename = format!("{}.md", timestamp);
    let path = full_notebook_path.join(&filename);

    fs::write(&path, &content).map_err(|e| e.to_string())?;

    Ok(NoteFile {
        filename,
        content,
        created_at: timestamp,
    })
}

#[tauri::command]
fn update_note(vault_path: String, notebook_path: String, filename: String, content: String) -> Result<NoteFile, String> {
    let path = PathBuf::from(&vault_path).join(&notebook_path).join(&filename);
    if !path.exists() {
        return Err("Note does not exist".to_string());
    }

    fs::write(&path, &content).map_err(|e| e.to_string())?;

    let stem = path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let created_at = stem.parse::<u64>().unwrap_or(0);

    Ok(NoteFile {
        filename,
        content,
        created_at,
    })
}

#[tauri::command]
fn delete_note(vault_path: String, notebook_path: String, filename: String) -> Result<(), String> {
    let path = PathBuf::from(&vault_path).join(&notebook_path).join(&filename);
    if !path.exists() {
        return Err("Note does not exist".to_string());
    }

    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_image(vault_path: String, image_data: String, extension: String) -> Result<String, String> {
    let vault = PathBuf::from(&vault_path);
    if !vault.exists() {
        return Err("Vault does not exist".to_string());
    }

    let attachments_path = vault.join("attachments");
    if !attachments_path.exists() {
        fs::create_dir_all(&attachments_path).map_err(|e| e.to_string())?;
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    let filename = format!("{}.{}", timestamp, extension);
    let file_path = attachments_path.join(&filename);

    let image_bytes = BASE64.decode(&image_data).map_err(|e| e.to_string())?;
    fs::write(&file_path, image_bytes).map_err(|e| e.to_string())?;

    Ok(format!("attachments/{}", filename))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_notebooks,
            create_notebook,
            rename_notebook,
            delete_notebook,
            list_notes,
            read_note,
            create_note,
            update_note,
            delete_note,
            save_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
