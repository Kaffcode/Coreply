const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
    ? '- STRICT: each reply must be under 40 words.'
    : '- Keep each reply concise and natural.';

  const systemPrompt = `You are a social media expert helping users write great replies on X (Twitter).
Generate exactly 2 different reply options ${toneDescription}.

Rules:
- Sound natural and authentic, like a real person
- Do NOT start with "Great post!", "Absolutely!", or generic openers
- Do NOT use the phrase "game changer"
- Do NOT add hashtags unless they genuinely add value
${wordLimit}
- Make the 2 replies meaningfully different from each other

IMPORTANT formatting rules:
- Option 1: plain text only, absolutely NO emoji anywhere
- Option 2: end the reply with exactly 1 emoji that genuinely fits the emotion or content
  Examples: 🔥 excitement, 💡 insight, 🤔 curiosity, 😂 humor, 💪 motivation, 😮 surprise, 🎯 sharp point
  The emoji must feel natural — not generic or random

Output ONLY a valid JSON array with exactly 2 strings: ["plain reply", "reply with emoji at the end"]
No markdown, no explanation, just the JSON array`;

  const userPrompt = `Write 2 different replies to this tweet:\n"${tweetContent}"${language && language !== 'same as tweet' ? `\n\nImportant: Reply in ${language}.` : ''}`;

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
      max_tokens: WORD_LIMITED_TONES.includes(toneId) ? 250 : 600,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API Error: ${response.status}`);
  }

  const data = await response.json();
  const raw  = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('No reply generated from API.');

  let replies;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    replies = JSON.parse(clean);
    if (!Array.isArray(replies) || replies.length === 0) throw new Error();
  } catch {
    replies = raw.split(/\n+/).filter(l => l.trim()).slice(0, 2);
  }

  while (replies.length < 2) replies.push(replies[0] || '');
  replies = replies.slice(0, 2).map(r =>
    String(r).replace(/^["'\d.\-\s]+/, '').replace(/["']$/, '').trim()
  );

  // Đảm bảo option 1 không có emoji
  replies[0] = replies[0].replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();

  return { replies };
}
