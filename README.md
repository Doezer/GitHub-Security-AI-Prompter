# GitHub Security AI Prompter

A small Chrome (Manifest V3) extension that turns the alerts listed on a
GitHub **Code scanning** page (`/<owner>/<repo>/security/code-scanning`) into a
clean, grouped prompt you can paste into an AI coding assistant.

No build step, no dependencies, no accounts: load the folder unpacked and click
the icon. Sister project of [SonarQube-AI-Prompter](https://github.com/Doezer/SonarQube-AI-Prompter).

## What it does

1. Open your repository's **Security → Code scanning** page (apply any filter you like: severity, tool, branch, path).
2. Click the extension icon, then **Generate & Copy Prompt**.
3. The extension reads the alerts rendered on that page: title, alert number and link, severity, detecting tool (CodeQL, Trivy, Scorecard, ...), labels and the file/line.
4. It groups them by file, most severe first, into a Markdown prompt, shows it in the popup and copies it to your clipboard.

Example output:

```
### File: `server/services/ImportStrategies.ts`
- **L439** [High] Uncontrolled data used in path expression (#408, CodeQL) - https://github.com/owner/repo/security/code-scanning/408
```

Dependency findings (e.g. Trivy on `package.json`) are asked to be fixed by
upgrading to a patched version. Alerts with no file (e.g. Scorecard) are listed
under "No file associated with the alert". Truncated paths such as
`usr/.../tar/package.json` are expanded to the full path.

### Privacy

Everything runs locally in your browser. No backend, no network requests, and
nothing is sent anywhere. The only data touched is the DOM of the tab you click
the extension on.

## Requirements

- Chrome, Edge, Brave or another Chromium browser with Manifest V3 support.
- A `github.com` code scanning alerts page. Other pages (Dependabot, secret
  scanning, individual alert pages) are refused with an error in the popup.

## Install

Download the zip from [Releases](../../releases), unzip it somewhere permanent,
open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**
and select the folder. From source:

```powershell
git clone https://github.com/Doezer/GitHub-Security-AI-Prompter.git
```

## Known limitations

- **Only the alerts currently on the page are captured.** GitHub paginates the
  list (25 per page); go to each page you need, or filter first.
- **GitHub's DOM is not a public API.** The extractor matches the current
  `ul.js-alert-list` markup; selector fixes after a redesign are welcome.
- Only `github.com` is supported (not GitHub Enterprise Server).
- No toolbar icons are shipped.

## Repository layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 configuration. |
| `popup.html` | The popup UI. |
| `popup.js` | Page guard, injected `extractSecurityAlerts` extractor and prompt formatting. |
| `scripts/validate-extension.mjs` | Sanity checks, also run in CI. |

## Permissions

`activeTab` + `scripting` only, to read the tab you invoke the extension on. No host permissions.

## Development

```powershell
node --check popup.js
node scripts/validate-extension.mjs
```

Then reload the unpacked extension and try it on a real alerts page. Pushing a
`v*` tag packages a release zip via `.github/workflows/release.yml`.

## License

[MIT](LICENSE).
