document.addEventListener('DOMContentLoaded', async () => {
  const s = await chrome.storage.sync.get(['groqApiKey', 'myStyle', 'language', 'model']);

  if (s.groqApiKey) document.getElementById('apiKey').value    = s.groqApiKey;
  if (s.myStyle)    document.getElementById('myStyle').value   = s.myStyle;
  if (s.language)   document.getElementById('language').value  = s.language;
  if (s.model)      document.getElementById('model').value     = s.model;

  // Toggle visibility of API key
  document.getElementById('toggleKey').addEventListener('click', () => {
    const inp = document.getElementById('apiKey');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Save
  document.getElementById('save').addEventListener('click', async () => {
    await chrome.storage.sync.set({
      groqApiKey: document.getElementById('apiKey').value.trim(),
      myStyle:    document.getElementById('myStyle').value.trim(),
      language:   document.getElementById('language').value,
      model:      document.getElementById('model').value,
    });

    const msg = document.getElementById('saveMsg');
    msg.textContent = '✓ Saved!';
    msg.style.color = '#00ba7c';
    setTimeout(() => (msg.textContent = ''), 2500);
  });
});
