document.addEventListener('DOMContentLoaded', () => {
  const proxyInput = document.getElementById('proxy');
  const saveBtn = document.getElementById('saveProxy');
  const fetchProxyBtn = document.getElementById('fetchProxyBtn');
  const clearBtn = document.getElementById('clearDomains');
  const domainList = document.getElementById('domainList');
  const newDomainInput = document.getElementById('newDomain');
  const addDomainBtn = document.getElementById('addDomain');

  chrome.storage.local.get(['proxyAddress', 'blockedDomains', 'proxyStatus'], (data) => {
    if (data.proxyAddress) proxyInput.value = data.proxyAddress;
    if (data.proxyStatus) document.getElementById('statusMsg').textContent = data.proxyStatus;
    renderDomains(data.blockedDomains || []);
  });

  saveBtn.addEventListener('click', () => chrome.storage.local.set({ proxyAddress: proxyInput.value }));
  
  fetchProxyBtn.addEventListener('click', () => {
    fetchProxyBtn.textContent = 'Racing...';
    document.getElementById('statusMsg').textContent = "Starting proxy race...";
    chrome.runtime.sendMessage({action: "forceProxyRace"}, () => {
      setTimeout(() => { fetchProxyBtn.textContent = 'Auto-Fetch Fastest Free Proxy'; }, 2000);
    });
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
    if (area === 'local') {
      if (changes.blockedDomains) renderDomains(changes.blockedDomains.newValue || []);
      if (changes.proxyAddress) proxyInput.value = changes.proxyAddress.newValue || '';
      if (changes.proxyStatus) document.getElementById('statusMsg').textContent = changes.proxyStatus.newValue || '';
    }
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
