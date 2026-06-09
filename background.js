const targetErrors = ['net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_TIMED_OUT'];
const ispBlockKeywords = ['block', 'intercept', 'restricted', 'warning'];
let reloadAttempts = {};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const defaultDomains = ['x.com', 'twitter.com', 'facebook.com', 'youtube.com', 'instagram.com', 'whatsapp.com', 'telegram.org', 'tiktok.com'];
    await chrome.storage.local.set({ blockedDomains: defaultDomains });
    
    // Auto-fetch a free proxy to work out of the box
    try {
      const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&ssl=yes&anonymity=elite');
      const text = await res.text();
      const proxies = text.split('\n').filter(p => p.trim() !== '');
      if (proxies.length > 0) {
        await chrome.storage.local.set({ proxyAddress: `PROXY ${proxies[0].trim()}` });
      }
    } catch (e) {
      console.error('Proxy fetch failed', e);
    }
  }
});

chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
  if (details.frameId === 0 && targetErrors.includes(details.error)) {
    await handleBlockedDomain(new URL(details.url).hostname, details.tabId);
  }
});

chrome.webRequest.onBeforeRedirect.addListener(async (details) => {
  if (details.type === 'main_frame') {
    const redirectUrl = details.redirectUrl.toLowerCase();
    if (ispBlockKeywords.some(keyword => redirectUrl.includes(keyword))) {
      await handleBlockedDomain(new URL(details.url).hostname, details.tabId);
    }
  }
}, {urls: ["<all_urls>"]});

async function handleBlockedDomain(domain, tabId) {
  const data = await chrome.storage.local.get(['blockedDomains', 'proxyAddress']);
  let domains = data.blockedDomains || [];
  
  if (!domains.includes(domain)) {
    domains.push(domain);
    await chrome.storage.local.set({ blockedDomains: domains });
    
    reloadAttempts[domain] = (reloadAttempts[domain] || 0) + 1;
    if (reloadAttempts[domain] === 1 && tabId > 0) {
      setTimeout(() => chrome.tabs.reload(tabId), 1000); // Reload once only (Anti-Infinite Loop)
    }
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    chrome.storage.local.get(['blockedDomains', 'proxyAddress'], (data) => {
      updateProxySettings(data.blockedDomains || [], data.proxyAddress);
    });
  }
});

function updateProxySettings(domains, proxyAddress) {
  if (!proxyAddress || domains.length === 0) {
    chrome.proxy.settings.clear({scope: 'regular'});
    return;
  }
  
  const escapedDomains = domains.map(d => `"${d}"`).join(', ');
  const pacScript = `
    function FindProxyForURL(url, host) {
      var blockedDomains = [${escapedDomains}];
      for (var i = 0; i < blockedDomains.length; i++) {
        if (dnsDomainIs(host, blockedDomains[i]) || host === blockedDomains[i]) {
          return "${proxyAddress}; DIRECT"; // Fallback to DIRECT if proxy fails
        }
      }
      return "DIRECT";
    }
  `;

  chrome.proxy.settings.set({ value: { mode: "pac_script", pacScript: { data: pacScript } }, scope: 'regular' });
}
