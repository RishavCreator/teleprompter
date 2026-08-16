# Progress So Far

## Electron Application Conversion
- Cloned the repository.
- Initialized Electron dependencies (`electron`, `electron-builder`).
- Created `main.js` to serve as the Electron entry point, wrapping the existing Express/WebSocket server.
- Configured `package.json` for building a Windows NSIS installer.
- Built the `.exe` installer.
- Formatted the entire codebase using Prettier.
- Updated the application icon to the provided custom icon (`teleprompter icon.png`) and rebuilt the installer.

## Feature Additions and Fixes
- **PDF Upload Fix**: Initially, uploading a PDF caused the app to crash due to improper handling. Added proper error alerts and `console.error` logs to safely ignore unsupported formats.
- **Added PDF Support**: Integrated `pdf.js` to natively parse text from uploaded PDF files on the client side. Added support in both `controller.js` and `script.js`.
- **Added Markdown (.md) Support**: Integrated `marked.js` to parse `.md` files. It converts the markdown to HTML internally, extracts the clean textual content (stripping markdown tags), and properly formats it for the teleprompter.
- **HTML Update**: Updated both `index.html` and `controller.html` to include the CDNs for `pdf.js` and `marked.js`, and updated the file upload `accept` attributes to include `.pdf` and `.md`.

- **QR Code Mobile Connection**: Added an `/api/ip` endpoint to `server.js` to automatically fetch the local network IP address (instead of localhost). Updated `controller.html` and `controller.js` to include a "Show QR Code" button that dynamically renders a QR Code of the local display URL using `qrcode.js`. This allows easy mobile connections by simply scanning the screen.

*This file will be updated as further changes are made.*
