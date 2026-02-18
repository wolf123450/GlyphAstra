use serde_json::json;
use std::path::Path;

// File system operations
#[tauri::command]
async fn check_ollama_connection() -> Result<bool, String> {
    match reqwest::get("http://localhost:11434/api/tags").await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn list_ollama_models() -> Result<Vec<String>, String> {
    match reqwest::get("http://localhost:11434/api/tags").await {
        Ok(response) => {
            match response.json::<serde_json::Value>().await {
                Ok(data) => {
                    let models: Vec<String> = data
                        .get("models")
                        .and_then(|m| m.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();
                    Ok(models)
                }
                Err(e) => Err(format!("Failed to parse models: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to fetch models: {}", e)),
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_ollama_connection,
            list_ollama_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
