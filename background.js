const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getTonePrompt(toneId, myStyle) {
  const tones = {
    'my-style': myStyle || 'in a natural, authentic personal style',
    'casual': 'in a casual, conversational and friendly tone. Keep it relaxed and natural.',
    'positive': 'in a positive, uplifting and enthusiastic tone. Show genuine support or excitement.',
    'professional': 'in a professional, polished and credible tone. Be concise and authoritative.',
    'funny': 'in a funny, witty and humorous way. Be clever and light-hearted.',
    'question': 'by asking a thoughtful, engaging question that invites discussion.',
    'supportive': 'in a warm, empathetic and supportive tone.',
    'concise': 'very concisely. Maximum 1-2 short sentences.',
  };
  return tones[toneId] || tones['casual'];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateReply') {
    handleGenerateReply(message)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async
  }

  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});

async function handleGenerateReply({ tweetContent, toneId, myStyle, language, model, apiKey }) {
  const toneDescription = getTonePrompt(toneId, myStyle);
  const selectedModel = model || 'llama-3.3-70b-versatile';

  const systemPrompt = `You are a social media expert helping users write great replies on X (Twitter).
Generate a reply ${toneDescription}.

Rules:
- Sound natural and authentic, like a real person
- Do NOT start with "Great post!", "Absolutely!", or generic openers
- Do NOT add hashtags unless they genuinely add value
- Keep it concise (1-3 sentences typically)
- Do NOT explain what you're doing or add preamble
- Just output the reply text directly`;

  const userPrompt = `Write a reply to this tweet:\n"${tweetContent}"${language && language !== 'same as tweet' ? `\n\nImportant: Reply in ${language}.` : ''}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API Error: ${response.status}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('No reply generated from API.');

  return { reply };
}
