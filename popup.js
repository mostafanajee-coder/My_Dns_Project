document.addEventListener('DOMContentLoaded', () => {
  const proxyInput = document.getElementById('proxy');
  const saveBtn = document.getElementById('saveProxy');
  const clearBtn = document.getElementById('clearDomains');
  const domainList = document.getElementById('domainList');
  const newDomainInput = document.getElementById('newDomain');
  const addDomainBtn = document.getElementById('addDomain');

  chrome.storage.local.get(['proxyAddress', 'blockedDomains'], (data) => {
    if (data.proxyAddress) proxyInput.value = data.proxyAddress;
    renderDomains(data.blockedDomains || []);
  });

  saveBtn.addEventListener('click', () => chrome.storage.local.set({ proxyAddress: proxyInput.value }));
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
