fn main() {
    println!("cargo:rerun-if-env-changed=VITE_SUPABASE_URL");
    println!("cargo:rerun-if-env-changed=VITE_SUPABASE_PUBLISHABLE_KEY");
    #[cfg(feature = "desktop")]
    {
        println!("cargo:rerun-if-changed=../.env");
        // Vite and Rust must trust the same public Auth endpoint. Environment wins over .env.
        let file_values = dotenvy::from_path_iter("../.env")
            .ok()
            .into_iter()
            .flatten()
            .filter_map(Result::ok)
            .collect::<std::collections::HashMap<_, _>>();
        for name in ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] {
            let value = std::env::var(name)
                .ok()
                .or_else(|| file_values.get(name).cloned())
                .unwrap_or_default();
            if value.contains(['\n', '\r'])
                || (name.ends_with("KEY")
                    && !value.is_empty()
                    && !value.starts_with("sb_publishable_"))
            {
                panic!("Native Auth requires a publishable public key, never an admin credential");
            }
            println!("cargo:rustc-env={name}={value}");
        }
        tauri_build::build();
    }
}
