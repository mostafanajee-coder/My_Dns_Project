const targetErrors = ['net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_TIMED_OUT'];
const proxyErrors = ['net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_PROXY_CONNECTION_FAILED'];
const ispBlockKeywords = ['block', 'intercept', 'restricted', 'warning'];
let reloadAttempts = {};
let isFindingProxy = false;
let lastProxyFetchTime = 0;

const proxySources = [
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt'
];

async function fetchRawProxies() {
  let proxies = [];
  for (const url of proxySources) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const list = text.split('\n').map(p => p.trim()).filter(p => p.includes(':'));
      const type = url.includes('socks5') ? 'SOCKS5' : 'PROXY';
      proxies.push(...list.map(p => `${type} ${p}`));
    } catch(e) {}
  }
  return proxies.sort(() => 0.5 - Math.random());
}

async function findFastestProxy() {
  const proxies = await fetchRawProxies();
  if (proxies.length === 0) return null;
  
  const batch = proxies.slice(0, 50); // Race 50 proxies simultaneously!
  
  let pacRules = '';
  batch.forEach((proxy, index) => {
    pacRules += `if (url.indexOf("proxy_test_id=${index}") !== -1) return "${proxy}";\n`;
  });
  
  const testPacScript = `
    function FindProxyForURL(url, host) {
      ${pacRules}
      return "DIRECT";
    }
  `;
  
  await new Promise(resolve => {
    chrome.proxy.settings.set({ value: { mode: "pac_script", pacScript: { data: testPacScript } }, scope: 'regular' }, resolve);
  });
  
  await new Promise(r => setTimeout(r, 500)); // Allow PAC to initialize
  
  const fetchPromises = batch.map((proxy, index) => {
    return new Promise(async (resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); reject('Timeout'); }, 3000);
      try {
        await fetch(`https://1.1.1.1/?proxy_test_id=${index}`, { 
          signal: controller.signal, 
          cache: 'no-store',
          mode: 'no-cors'
        });
        clearTimeout(timeout);
        resolve(proxy); // The first one to resolve this wins!
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  });
  
  try {
    const fastestProxy = await Promise.any(fetchPromises);
    return fastestProxy;
  } catch (e) {
    return null;
  }
}

async function executeProxyRace(tabId = null) {
  if (isFindingProxy) return;
  isFindingProxy = true;
  await chrome.storage.local.set({ proxyStatus: "Racing 50 proxies..." });
  
  const fastestProxy = await findFastestProxy();
  
  if (fastestProxy) {
    await chrome.storage.local.set({ proxyAddress: fastestProxy, proxyStatus: `Connected!` });
    const data = await chrome.storage.local.get(['blockedDomains']);
    updateProxySettings(data.blockedDomains || [], fastestProxy);
    if (tabId > 0) setTimeout(() => chrome.tabs.reload(tabId), 1000);
  } else {
    await chrome.storage.local.set({ proxyStatus: "Race failed. Try again." });
    chrome.proxy.settings.clear({scope: 'regular'});
  }
  isFindingProxy = false;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const defaultDomains = ['x.com', 'twitter.com', 'facebook.com', 'youtube.com', 'instagram.com', 'whatsapp.com', 'telegram.org', 'tiktok.com'];
    await chrome.storage.local.set({ blockedDomains: defaultDomains });
    executeProxyRace();
  }
});

chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
  if (details.frameId === 0) {
    if (targetErrors.includes(details.error)) {
      await handleBlockedDomain(new URL(details.url).hostname, details.tabId);
    } else if (proxyErrors.includes(details.error)) {
      const now = Date.now();
      if (now - lastProxyFetchTime > 15000) {
        lastProxyFetchTime = now;
        executeProxyRace(details.tabId);
      }
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
  const data = await chrome.storage.local.get(['blockedDomains']);
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.proxyAddress && !isFindingProxy) {
    chrome.storage.local.get(['blockedDomains'], (data) => {
      updateProxySettings(data.blockedDomains || [], changes.proxyAddress.newValue);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "forceProxyRace") {
    executeProxyRace();
    sendResponse({started: true});
  }
});
