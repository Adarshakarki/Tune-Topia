# Chrome extension

Load this folder as an unpacked extension in Chrome:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `extension/` folder

This extension injects `window.__tidalOriginExtension = true` at `document_start` in the page's main world.
