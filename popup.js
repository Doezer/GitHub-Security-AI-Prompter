document.getElementById('extractBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const resultArea = document.getElementById('result');
  const btn = document.getElementById('extractBtn');

  // Verify we are on a GitHub code scanning alerts list.
  if (!isSupportedAlertsPage(tab.url)) {
    resultArea.value = "Error: Please open a GitHub code scanning alerts page (/<owner>/<repo>/security/code-scanning).";
    return;
  }

  btn.innerText = "Extracting...";

  // Inject and execute the extraction function in the active tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractSecurityAlerts
  }, (results) => {
    if (chrome.runtime.lastError || !results?.[0]?.result) {
      resultArea.value = `Error: ${chrome.runtime.lastError?.message ?? "Could not extract alerts from the page."}`;
      btn.innerText = "Generate & Copy Prompt";
      return;
    }

    const promptText = results[0].result;
    resultArea.value = promptText;

    // Copy to clipboard
    navigator.clipboard.writeText(promptText).then(() => {
      btn.innerText = "Copied to Clipboard! ✓";
      btn.style.backgroundColor = "#16a34a"; // Green success color
      setTimeout(() => {
        btn.innerText = "Generate & Copy Prompt";
        btn.style.backgroundColor = "#2563eb";
      }, 3000);
    }).catch(() => {
      btn.innerText = "Generate & Copy Prompt";
    });
  });
});

function isSupportedAlertsPage(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return url.hostname === "github.com" &&
      /^\/[^/]+\/[^/]+\/security\/code-scanning\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

// --- THIS FUNCTION RUNS INSIDE THE GITHUB WEBPAGE ---
function extractSecurityAlerts() {
  const repo = location.pathname.split('/').slice(1, 3).join('/');
  const severityRank = { critical: 0, high: 1, medium: 2, moderate: 2, low: 3, warning: 3, note: 4, error: 1 };
  const NO_FILE = "No file associated with the alert";
  const alertsByFile = {};
  let alertCount = 0;

  // Each alert is a row of the alert list
  const alertNodes = document.querySelectorAll('ul.js-alert-list > li');

  alertNodes.forEach(node => {
    // 1. Title and link: the primary link points to /security/code-scanning/<number>
    const titleNode = node.querySelector('a[href*="/security/code-scanning/"]');
    if (!titleNode) return;
    const title = titleNode.innerText.trim();
    const number = (titleNode.getAttribute('href').match(/\/code-scanning\/(\d+)/) || [])[1] || "?";
    const url = new URL(titleNode.getAttribute('href'), location.origin).href;

    // 2. Severity label, e.g. "High"
    const severityNode = node.querySelector('a.Label[id^="alert-severity-"]');
    const severity = severityNode ? severityNode.innerText.trim() : "Unknown";

    // 3. Detection tool: "Detected by <b>CodeQL</b>"
    const toolNode = node.querySelector('a[href*="tool%3A"] b');
    const tool = toolNode ? toolNode.innerText.trim() : "Unknown tool";

    // 4. Other labels (e.g. "Library" for dependency findings)
    const tags = [...node.querySelectorAll('a.Label--secondary')].map(l => l.innerText.trim()).filter(Boolean);

    // 5. File path and line. The visible path can be truncated ("usr/.../package.json"),
    // so prefer the full path from its tooltip, then the path: filter in the link URL.
    let file = NO_FILE;
    let line = "";
    const fileLink = node.querySelector('a[id^="file-path-"]');
    if (fileLink) {
      let path = "";
      const tooltip = document.getElementById(fileLink.getAttribute('aria-describedby') || "");
      if (tooltip) {
        path = tooltip.textContent.trim();
      } else {
        const param = (fileLink.getAttribute('href').match(/path%3A(?:%22)?([^&]+?)(?:%22)?(?:&|$)/) || [])[1];
        try { path = param ? decodeURIComponent(param).replace(/\+/g, ' ') : ""; } catch { path = ""; }
      }
      if (!path) path = fileLink.innerText.trim();
      if (path && path !== "no file associated with this alert" && path !== "no file associated with ...") {
        file = path;
        // The line number follows the link as ":<line>"
        line = ((fileLink.nextSibling?.textContent || "").match(/^\s*:\s*(\d+)/) || [])[1] || "";
      }
    }

    if (!alertsByFile[file]) alertsByFile[file] = [];
    alertsByFile[file].push({ number, title, severity, tool, tags, url, line });
    alertCount++;
  });

  if (alertCount === 0) {
    return "Could not detect alerts automatically. Please ensure the page has fully loaded and alerts are visible.";
  }

  const rank = severity => severityRank[severity.toLowerCase()] ?? 5;
  const worst = alerts => Math.min(...alerts.map(a => rank(a.severity)));

  let prompt = `I need to fix the following GitHub code scanning security alerts in \`${repo}\`. ` +
    "For each alert, explain the risk briefly and provide the corrected code. " +
    "For vulnerable dependencies (e.g. Trivy findings on a package.json or lock file), " +
    "give the patched version to upgrade to or a safe alternative. " +
    "Start with the most severe alerts, and tell me if an alert looks like a false positive.\n\n";

  // Files with the most severe alerts first; alerts without a file last
  const files = Object.entries(alertsByFile).sort(([fa, a], [fb, b]) =>
    (fa === NO_FILE) - (fb === NO_FILE) || worst(a) - worst(b));

  for (const [file, alerts] of files) {
    prompt += `### File: \`${file}\`\n`;
    alerts.sort((a, b) => rank(a.severity) - rank(b.severity)).forEach(alert => {
      const where = alert.line ? `L${alert.line}` : "no line";
      const extra = alert.tags.length ? `, ${alert.tags.join(', ')}` : "";
      prompt += `- **${where}** [${alert.severity}] ${alert.title} ` +
        `(#${alert.number}, ${alert.tool}${extra}) - ${alert.url}\n`;
    });
    prompt += `\n`;
  }

  return prompt;
}
