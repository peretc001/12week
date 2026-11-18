use tauri::Manager;

#[tauri::command]
async fn open_calendar_event(
    app: tauri::AppHandle,
    calendar: String,
    event_id: String,
) -> Result<(), String> {
    use std::hash::{DefaultHasher, Hash, Hasher};

    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("calendar");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let mut hasher = DefaultHasher::new();
    event_id.hash(&mut hasher);
    let file = directory.join(format!("{:016x}.ics", hasher.finish()));
    std::fs::write(&file, calendar).map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    let mut opener = {
        let mut command = std::process::Command::new("/usr/bin/open");
        command.args(["-b", "com.apple.iCal"]);
        command
    };
    #[cfg(target_os = "windows")]
    let mut opener = std::process::Command::new("explorer.exe");
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut opener = std::process::Command::new("xdg-open");

    let status = opener
        .arg(&file)
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Calendar opener exited with {status}"))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![tauri_plugin_sql::Migration {
        version: 1,
        description: "create tracker tables",
        sql: include_str!("../migrations/001_init.sql"),
        kind: tauri_plugin_sql::MigrationKind::Up,
    }];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_calendar_event])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tracker.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
