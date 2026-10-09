// Android UI contract using injected IPC, not an Android WebView/device or persistence test.
process.env.TIMORA_UI_PLATFORM = 'android';
await import('./desktop-ui.mjs');
