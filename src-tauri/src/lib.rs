// File system operations
#[tauri::command]
async fn check_ollama_connection() -> Result<bool, String> {
    match reqwest::get("http://localhost:11434/api/tags").await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Fetch a URL from the Rust backend (bypasses WebView CORS restrictions).
/// Returns the response body as a base64-encoded string plus the Content-Type header.
#[tauri::command]
async fn fetch_url_bytes(url: String) -> Result<(String, String), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Fetch failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .split(';')
        .next()
        .unwrap_or("image/png")
        .trim()
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok((b64, content_type))
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_ollama_connection,
            list_ollama_models,
            fetch_url_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
