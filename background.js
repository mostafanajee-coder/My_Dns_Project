const targetErrors = ['net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_TIMED_OUT'];
const proxyErrors = ['net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_PROXY_CONNECTION_FAILED'];
const ispBlockKeywords = ['block', 'intercept', 'restricted', 'warning'];
let reloadAttempts = {};
let lastProxyFetchTime = 0;

async function fetchFreeProxy() {
  try {
    // Fetching from a more advanced API that sorts by speed and latency
    const res = await fetch('https://proxylist.geonode.com/api/proxy-list?limit=5&page=1&sort_by=speed&sort_type=asc&protocols=socks5,http&anonymityLevel=elite');
    if (!res.ok) throw new Error("Geonode API failed");
    
    const json = await res.json();
    if (json.data && json.data.length > 0) {
      // Create an array of the top 3 fastest proxies for PAC failover
      const topProxies = json.data.slice(0, 3).map(p => {
        const type = p.protocols.includes('socks5') ? 'SOCKS5' : 'PROXY';
        return `${type} ${p.ip}:${p.port}`;
      });
      return topProxies.join('; ');
    }
  } catch (e) {
    console.error('Fast proxy fetch failed, falling back to basic list', e);
    // Fallback to basic text list if API is down
    try {
      const res2 = await fetch('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt');
      const text = await res2.text();
      const proxies = text.split('\n').filter(p => p.trim() !== '');
      if (proxies.length > 0) {
        return `PROXY ${proxies[5].trim()}; PROXY ${proxies[6].trim()}`;
      }
    } catch(err) {
      console.error(err);
    }
  }
  return null;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const defaultDomains = ['x.com', 'twitter.com', 'facebook.com', 'youtube.com', 'instagram.com', 'whatsapp.com', 'telegram.org', 'tiktok.com'];
    await chrome.storage.local.set({ blockedDomains: defaultDomains });
    const freeProxy = await fetchFreeProxy();
    if (freeProxy) await chrome.storage.local.set({ proxyAddress: freeProxy });
  }
});

chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
  if (details.frameId === 0) {
    if (targetErrors.includes(details.error)) {
      await handleBlockedDomain(new URL(details.url).hostname, details.tabId);
    } else if (proxyErrors.includes(details.error)) {
      await handleBadProxy(details.tabId);
    }
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
      setTimeout(() => chrome.tabs.reload(tabId), 1000);
    }
  }
}

async function handleBadProxy(tabId) {
  const now = Date.now();
  if (now - lastProxyFetchTime > 15000) { // Fetch max once every 15s to prevent loops
    lastProxyFetchTime = now;
    const newProxy = await fetchFreeProxy();
    if (newProxy) {
      await chrome.storage.local.set({ proxyAddress: newProxy });
      if (tabId > 0) setTimeout(() => chrome.tabs.reload(tabId), 1500);
    } else {
      chrome.proxy.settings.clear({scope: 'regular'});
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
          return "${proxyAddress}; DIRECT";
        }
      }
      return "DIRECT";
    }
  `;

  chrome.proxy.settings.set({ value: { mode: "pac_script", pacScript: { data: pacScript } }, scope: 'regular' });
}
