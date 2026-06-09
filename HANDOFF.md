# HANDOFF

**Goal:** Build a "Dynamic Smart Proxy" Chrome Extension (Manifest V3) that detects DPI/SNI blocked domains (via specific connection resets) and selectively routes them through a user-defined proxy using a PAC script.

**Key Files:**
- `manifest.json`: Defines extension metadata and permissions.
- `background.js`: Handles network error interception and dynamically generates the PAC script.
- `popup.html`: Minimal UI for proxy configuration and domain listing.
- `popup.js`: Logic for managing user input and storage interaction.

**Next Steps:**
- Extension is ready to be loaded unpacked into Chrome (`chrome://extensions/`).
- Test against blocked domains to verify routing logic triggers.
