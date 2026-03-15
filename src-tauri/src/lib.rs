// HTTP proxy commands for CORS bypass and Ollama connectivity

use reqwest::Client;
use tauri::State;

/// Shared HTTP client — connection-pooled, reused across all commands.
struct HttpClient(Client);

/// Allowed URL schemes for fetch_url_bytes.
/// Only HTTPS and HTTP are permitted; file://, data:, javascript: etc. are blocked.
fn is_allowed_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        // Block requests to cloud metadata / link-local endpoints
        let lower = trimmed.to_lowercase();
        if lower.contains("169.254.") || lower.contains("[fe80") || lower.contains("metadata.google")
           || lower.contains("metadata.aws") {
            return Err("Blocked: requests to cloud metadata endpoints are not allowed".to_string());
        }
        Ok(())
    } else {
        Err(format!("Blocked: only http:// and https:// URLs are allowed, got: {}", &trimmed[..trimmed.len().min(30)]))
    }
}

/// Maximum response body size (50 MB) to prevent memory exhaustion.
const MAX_RESPONSE_BYTES: usize = 50 * 1024 * 1024;

#[tauri::command]
async fn check_ollama_connection(http: State<'_, HttpClient>) -> Result<bool, String> {
    match http.0.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Fetch a URL from the Rust backend (bypasses WebView CORS restrictions).
/// Returns the response body as a base64-encoded string plus the Content-Type header.
/// Only http:// and https:// URLs are allowed. Response size is capped.
#[tauri::command]
async fn fetch_url_bytes(url: String, http: State<'_, HttpClient>) -> Result<(String, String), String> {
    is_allowed_url(&url)?;

    let response = http.0
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Fetch failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    // Check Content-Length header before reading the body
    if let Some(len) = response.content_length() {
        if len as usize > MAX_RESPONSE_BYTES {
            return Err(format!("Response too large: {} bytes (max {})", len, MAX_RESPONSE_BYTES));
        }
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

    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err(format!("Response too large: {} bytes (max {})", bytes.len(), MAX_RESPONSE_BYTES));
    }

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok((b64, content_type))
}

#[tauri::command]
async fn list_ollama_models(http: State<'_, HttpClient>) -> Result<Vec<String>, String> {
    match http.0.get("http://localhost:11434/api/tags").send().await {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("failed to build HTTP client");

    tauri::Builder::default()
        .manage(HttpClient(client))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::LogDir { file_name: Some("glyphastra".into()) }
                    ),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build()
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            check_ollama_connection,
            list_ollama_models,
            fetch_url_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
