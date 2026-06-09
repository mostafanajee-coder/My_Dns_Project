document.addEventListener('DOMContentLoaded', () => {
  const proxyInput = document.getElementById('proxy');
  const saveBtn = document.getElementById('saveProxy');
  const clearBtn = document.getElementById('clearDomains');
  const domainList = document.getElementById('domainList');

  // Load existing data
  chrome.storage.local.get(['proxyAddress', 'blockedDomains'], (data) => {
    if (data.proxyAddress) {
      proxyInput.value = data.proxyAddress;
    }
    renderDomains(data.blockedDomains || []);
  });

  // Save proxy
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({ proxyAddress: proxyInput.value });
  });

  // Clear domains
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ blockedDomains: [] });
  });

  // Listen for storage changes to update UI
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.blockedDomains) {
      renderDomains(changes.blockedDomains.newValue || []);
    }
  });

  function renderDomains(domains) {
    domainList.innerHTML = '';
    domains.forEach(domain => {
      const li = document.createElement('li');
      li.textContent = domain;
      domainList.appendChild(li);
    });
  }
});
