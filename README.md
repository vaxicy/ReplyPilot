# ReplyPilot

An AI email reply assistant for e-commerce sellers, built as a **Chrome Extension (Manifest V3)**.
ReplyPilot reads the currently open Gmail message, asks an AI model to draft a professional
customer-service reply, and lets you insert it into Gmail's reply box with one click.

> **Scope of v1**
> - Only **Gmail Web** (`https://mail.google.com/*`) is supported.
> - The user must **manually click** *Generate Reply* / *Insert Reply*.
> - **No** auto-send, **no** auto-reply, **no** modification of sent mail.

---

## 1. Project structure

```
replypilot/
├── manifest.json                  # MV3 manifest (permissions, content script, popup, options)
├── background/
│   └── service-worker.js          # minimal service worker (install + message relay)
├── content/
│   ├── gmail-content.js           # entry point: MutationObserver + injection orchestration
│   ├── gmail-dom.js               # ALL Gmail DOM reading + reply insertion (centralized selectors)
│   ├── reply-ui.js                # builds & manages the injected ReplyPilot card
│   └── content.css                # styles for the injected card
├── services/
│   ├── ai-service.js              # orchestrates prompt + call + reply parsing
│   └── siliconflow.js             # SiliconFlow chat-completions client (OpenAI compatible)
├── utils/
│   ├── storage.js                 # chrome.storage.local wrapper
│   ├── parser.js                  # language detection + prompt building
│   ├── i18n.js                    # runtime, in-app switchable i18n (loads _locales)
│   └── logger.js                  # safe logger (never logs secrets)
├── popup/
│   ├── popup.html / popup.css / popup.js   # toolbar popup (status + open settings)
├── options/
│   ├── options.html / options.css / options.js  # settings page
├── _locales/
│   ├── en/messages.json           # English strings
│   └── zh_CN/messages.json        # Simplified Chinese strings
├── icons/                         # icon16 / icon48 / icon128 (placeholder, replaceable)
└── README.md
```

All cross-file communication uses a single global namespace `window.RP`
(e.g. `RP.storage`, `RP.dom`, `RP.ai`, `RP.i18n`, `RP.ui`). Because multiple
JS files in one content script do **not** share top-level `const`/`let` bindings,
every module attaches its exports to `window.RP`.

---

## 2. Core files explained

| File | Responsibility |
|------|----------------|
| `manifest.json` | Declares `storage` + `activeTab` permissions, `host_permissions` for Gmail and `api.siliconflow.cn`, the content script, popup, options page, and background worker. Default locale `en`. |
| `content/gmail-dom.js` | Centralizes every Gmail selector in `GMAIL_SELECTORS`. Provides `getSubject`, `getSender`, `getEmailBody`, `getConversation`, `getReplyBoxes`, `insertReplyInto`. Degrades gracefully (returns `{ok:false, error}`). |
| `content/reply-ui.js` | Builds the card (Generate / Regenerate / Insert / Copy + status). One card per reply box, dedup via `box.dataset.rpUi`. |
| `content/gmail-content.js` | Uses `MutationObserver` (debounced) to detect reply boxes in Gmail's SPA and attaches the card; listens for language changes & popup refresh. |
| `services/siliconflow.js` | Calls `https://api.siliconflow.cn/v1/chat/completions`. Normalizes errors: 401/404/429/network/timeout. |
| `services/ai-service.js` | Builds the prompt from settings + email context, calls SiliconFlow, and parses the `{"reply": "..."}` JSON robustly (handles code fences). |
| `utils/i18n.js` | Loads `_locales/*/messages.json` at runtime so the user can switch language inside the extension, independent of the browser locale. |
| `utils/storage.js` | Stores all settings (incl. API key) in `chrome.storage.local`. |

---

## 3. Install & test

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `replypilot/` folder.
4. The extension icon appears in the toolbar. Pin it if you like.
5. On first install the **Options** page opens automatically.

**Test flow**
1. Open [https://mail.google.com](https://mail.google.com) and open any email.
2. Click **Reply** — a `✨ ReplyPilot` card appears above the reply box.
3. Click **Generate Reply** → a draft appears in the card textarea.
4. Edit if needed, then click **Insert Reply** → text is placed in Gmail's reply box.
5. Click **Copy Reply** to copy instead. You send manually.

> Switching emails does **not** create duplicate cards (dedup flag on each reply box).

---

## 4. SiliconFlow configuration

1. Get an API key from <https://siliconflow.cn> (dashboard → API Keys).
2. Open the **ReplyPilot** popup → **Open Settings** (or right-click the icon → Options).
3. Fill in:
   - **API Key** — your key (saved in `chrome.storage.local`, never in code/logs).
   - **Model ID** — e.g. `deepseek-ai/DeepSeek-V3` (default). Use any chat model SiliconFlow supports.
   - **Language** — English / 简体中文 (UI language).
   - **Reply Tone** — Professional / Friendly / Short / Luxury Brand.
   - **Brand info** — Name, Store Description, Shipping Policy, Return Policy, Extra Instructions (injected into the prompt).
4. Click **Save**.

---

## 5. Gmail testing notes

- The assistant only appears on `https://mail.google.com/*`.
- It matches reply / reply-all textboxes via `role="textbox"` + `contenteditable` + an
  `aria-label` containing *Reply* / *回复*. The compose "Body" box is intentionally excluded.
- The card is injected as the previous sibling of the reply textbox.
- Insertion uses `document.execCommand('insertText')` + `input`/`change` events so Gmail
  registers the text. The email is **never** auto-sent.

---

## 6. Current Gmail DOM selectors

All selectors live in `GMAIL_SELECTORS` inside `content/gmail-dom.js` and are tried **in order**;
none assume a single permanent class.

| Purpose | Selector candidates (first match wins) |
|---------|----------------------------------------|
| Subject | `h2[data-thread-perm-id]`, `.ha h2`, `h2`, `[role="heading"][aria-level="1"]` |
| Sender  | `.gD`, `span[email]`, `[data-hovercard-id]`, `.gE .gD` |
| Body    | `.a3s.aiL`, `.a3s`, `[role="listitem"] .a3s`, `.ii.gt .a3s`, `[data-message-id] .a3s` |
| Reply box | `[role="textbox"][contenteditable="true"][aria-label*="Reply" i]`, `[aria-label*="回复" i]`, `div[contenteditable="true"][aria-label*="Reply" i]`, `...回复` |

To add a new candidate when Google changes markup, prepend it to the relevant array —
no other code needs to change.

---

## 7. Known limitations

- **Gmail markup changes**: selectors may break after a Google update; re-verify `GMAIL_SELECTORS`.
- **Only Gmail**: no Outlook / Yahoo / 网易邮箱 / Shopify API yet.
- **No auto-send** by design (manual confirmation required).
- `web_accessible_resources` exposes `_locales` JSON only to `mail.google.com` so the
  content script can fetch translations.
- Icons are simple placeholders; replace `icons/icon*.png` with branded art.
- The reply box is detected by `aria-label` containing *Reply*; if Gmail localizes it
  differently in some locales the card may not attach (extend `GMAIL_SELECTORS.replyBox`).

---

## 8. Next-step suggestions

- Support additional email providers (Outlook, Yahoo) behind the same `RP.dom` interface.
- Add a "tone" quick-switch inside the card.
- Stream the model response into the textarea for a live feel.
- Persist last N generated replies per thread for quick reuse.
- Add unit tests for `parser.buildPrompt` and `ai-service.parseReply`.
- Consider a small options export/import for backup.

---

## Security

- API key is stored only in `chrome.storage.local`.
- Email content is sent **only** to the user-selected AI provider (`api.siliconflow.cn`).
- No email content is persisted locally or uploaded elsewhere.
- The logger never prints secrets; verbose logging is off by default.
