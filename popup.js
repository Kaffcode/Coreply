document.addEventListener('DOMContentLoaded', async () => {
  const { groqApiKey } = await chrome.storage.sync.get('groqApiKey');

  const dot = document.getElementById('dot');
  const txt = document.getElementById('statusTxt');

  if (groqApiKey) {
    dot.style.background = '#00ba7c';
    txt.textContent = 'Ready';
  } else {
    dot.style.background = '#f4212e';
    txt.textContent = 'API key not set';
  }

  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('getKey').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://console.groq.com/keys' });
  });
});
