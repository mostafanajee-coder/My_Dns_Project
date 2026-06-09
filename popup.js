document.addEventListener('DOMContentLoaded', () => {
  const proxyInput = document.getElementById('proxy');
  const saveBtn = document.getElementById('saveProxy');
  const fetchProxyBtn = document.getElementById('fetchProxyBtn');
  const clearBtn = document.getElementById('clearDomains');
  const domainList = document.getElementById('domainList');
  const newDomainInput = document.getElementById('newDomain');
  const addDomainBtn = document.getElementById('addDomain');

  chrome.storage.local.get(['proxyAddress', 'blockedDomains'], (data) => {
    if (data.proxyAddress) proxyInput.value = data.proxyAddress;
    renderDomains(data.blockedDomains || []);
  });

  saveBtn.addEventListener('click', () => chrome.storage.local.set({ proxyAddress: proxyInput.value }));
  
  fetchProxyBtn.addEventListener('click', async () => {
    fetchProxyBtn.textContent = 'Fetching Fastest Proxy...';
    try {
      const res = await fetch('https://proxylist.geonode.com/api/proxy-list?limit=5&page=1&sort_by=speed&sort_type=asc&protocols=socks5,http&anonymityLevel=elite');
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const topProxies = json.data.slice(0, 3).map(p => {
          const type = p.protocols.includes('socks5') ? 'SOCKS5' : 'PROXY';
          return `${type} ${p.ip}:${p.port}`;
        });
        const newProxyAddress = topProxies.join('; ');
        chrome.storage.local.set({ proxyAddress: newProxyAddress });
        proxyInput.value = newProxyAddress;
      }
    } catch(e) {
      alert("Failed to fetch fast proxy");
    }
    fetchProxyBtn.textContent = 'Auto-Fetch New Free Proxy';
  });

  clearBtn.addEventListener('click', () => chrome.storage.local.set({ blockedDomains: [] }));
  
  addDomainBtn.addEventListener('click', () => {
    const domain = newDomainInput.value.trim();
    if (domain) {
      chrome.storage.local.get(['blockedDomains'], (data) => {
        let domains = data.blockedDomains || [];
        if (!domains.includes(domain)) {
          domains.push(domain);
          chrome.storage.local.set({ blockedDomains: domains });
          newDomainInput.value = '';
        }
      });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.blockedDomains) renderDomains(changes.blockedDomains.newValue || []);
    if (area === 'local' && changes.proxyAddress) proxyInput.value = changes.proxyAddress.newValue || '';
  });

  function renderDomains(domains) {
    domainList.innerHTML = '';
    domains.forEach(domain => {
      const li = document.createElement('li');
      li.textContent = domain;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'X';
      removeBtn.className = 'remove-btn';
      removeBtn.onclick = () => removeDomain(domain);
      li.appendChild(removeBtn);
      domainList.appendChild(li);
    });
  }

  function removeDomain(domain) {
    chrome.storage.local.get(['blockedDomains'], (data) => {
      let domains = data.blockedDomains || [];
      domains = domains.filter(d => d !== domain);
      chrome.storage.local.set({ blockedDomains: domains });
    });
  }
});
