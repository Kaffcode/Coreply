const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Tones có giới hạn 40 từ
const WORD_LIMITED_TONES = ['casual','positive','professional','funny','question','supportive','concise'];

function getTonePrompt(toneId, myStyle) {
  const limit = WORD_LIMITED_TONES.includes(toneId) ? ' Maximum 40 words.' : '';
  const tones = {
    'my-style':     myStyle || 'in a natural, authentic personal style',
    'casual':       `in a casual, conversational and friendly tone. Keep it relaxed and natural.${limit}`,
    'positive':     `in a positive, uplifting and enthusiastic tone. Show genuine support or excitement.${limit}`,
    'professional': `in a professional, polished and credible tone. Be concise and authoritative.${limit}`,
    'funny':        `in a funny, witty and humorous way. Be clever and light-hearted.${limit}`,
    'question':     `by asking a thoughtful, engaging question that invites discussion.${limit}`,
    'supportive':   `in a warm, empathetic and supportive tone.${limit}`,
    'concise':      `very concisely. Maximum 1-2 short sentences.${limit}`,
  };
  return tones[toneId] || tones['casual'];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateReply') {
    handleGenerateReply(message)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});

async function handleGenerateReply({ tweetContent, toneId, myStyle, language, model, apiKey }) {
  const toneDescription = getTonePrompt(toneId, myStyle);
  const selectedModel   = model || 'llama-3.3-70b-versatile';
  const wordLimit       = WORD_LIMITED_TONES.includes(toneId)
    ? '- STRICT: reply must be under 40 words. Count carefully.'
    : '- Keep it concise and natural.';

  const systemPrompt = `You are a social media expert helping users write great replies on X (Twitter).
Generate a reply ${toneDescription}.

Rules:
- Sound natural and authentic, like a real person
- Do NOT start with "Great post!", "Absolutely!", or generic openers
- Do NOT use the phrase "game changer" — use "boom" or "fire" instead if needed
- Do NOT add hashtags unless they genuinely add value
${wordLimit}
- Do NOT explain what you're doing or add preamble
- Just output the reply text directly`;

  const userPrompt = `Write a reply to this tweet or comment:\n"${tweetContent}"${language && language !== 'same as tweet' ? `\n\nImportant: Reply in ${language}.` : ''}`;

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
        { role: 'user',   content: userPrompt   },
      ],
      // my-style không bị giới hạn 40 từ nên cho phép dài hơn
      max_tokens: WORD_LIMITED_TONES.includes(toneId) ? 120 : 300,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API Error: ${response.status}`);
  }

  const data  = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('No reply generated from API.');

  return { reply };
}
