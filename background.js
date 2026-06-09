const targetErrors = ['net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_CLOSED'];

chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
  if (details.frameId === 0 && targetErrors.includes(details.error)) {
    const url = new URL(details.url);
    const domain = url.hostname;
    
    const data = await chrome.storage.local.get(['blockedDomains', 'proxyAddress']);
    let domains = data.blockedDomains || [];
    const proxyAddress = data.proxyAddress;
    
    if (!domains.includes(domain)) {
      domains.push(domain);
      await chrome.storage.local.set({ blockedDomains: domains });
      if (proxyAddress) {
        updateProxySettings(domains, proxyAddress);
      }
    }
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    chrome.storage.local.get(['blockedDomains', 'proxyAddress'], (data) => {
      const domains = data.blockedDomains || [];
      const proxyAddress = data.proxyAddress;
      if (proxyAddress) {
        updateProxySettings(domains, proxyAddress);
      } else {
        chrome.proxy.settings.clear({scope: 'regular'});
      }
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
          return "${proxyAddress}";
        }
      }
      return "DIRECT";
    }
  `;

  const config = {
    mode: "pac_script",
    pacScript: {
      data: pacScript
    }
  };

  chrome.proxy.settings.set({ value: config, scope: 'regular' });
}
