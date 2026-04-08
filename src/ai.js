export const getProvider = (key) => {
  if (!key) return null;
  if (key.startsWith('AIza')) return 'Gemini';
  if (key.startsWith('sk-proj-') || key.startsWith('sk-')) return 'OpenAI';
  if (key.startsWith('sk-ant-')) return 'Claude';
  return 'Unknown';
};

const SYSTEM_PROMPT = `You are a professional Mind Map generator.
Respond strictly in JSON format matching this schema:
{
  "nodes": [ { "id": "unique_string", "type": "customNode", "position": {"x": 0, "y": 0}, "data": { "label": "Short Title", "memo": "Detailed description" } } ],
  "edges": [ { "id": "edge_id", "source": "parent_id", "target": "child_id" } ]
}
Make sure the root node has type: "root" and others have type: "customNode".
Keep labels concise (1-4 words). Use the memo field for rich details.
The root node should be positioned at x:0, y:0. You don't need to be perfectly mathematically precise with positions because an auto-layout engine will run after the data is loaded, just provide rough logical structure.`;

const ensureJson = (text) => {
  let cleaned = text.trim();
  // Remove markdown code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI JSON Parse Error. Original text:", text);
    // Attempt to extract JSON if there is text around it
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        throw new Error("Failed to parse AI response as JSON.");
      }
    }
    throw err;
  }
};

export const generateMap = async (topic, apiKey, model = 'gemini-2.5-flash') => {
  const provider = getProvider(apiKey);
  const userPrompt = `Create a comprehensive mind map about: "${topic}". Generate 10-15 highly structured nodes.`;
  return await callAI(provider, apiKey, SYSTEM_PROMPT, userPrompt, model);
};

export const expandIdea = async (nodeLabel, nodeMemo, apiKey, model = 'gemini-2.5-flash') => {
  const provider = getProvider(apiKey);
  const userPrompt = `Expand on the topic: "${nodeLabel}" (Context: ${nodeMemo || 'None'}). 
Generate 3-5 sub-topics as children. 
Return a valid JSON object with "nodes" and "edges" arrays. 
Do NOT include the parent node itself in the "nodes" list, only the NEW sub-topic nodes. 
For edges, use "PARENT_ID" as the source for all new edges. I will replace this placeholder with the actual ID.`;
  return await callAI(provider, apiKey, SYSTEM_PROMPT, userPrompt, model);
};

const callAI = async (provider, apiKey, system, user, model) => {
  if (provider === 'Gemini') {
    const fetchGemini = async (modelName, version = 'v1beta') => {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {}
      };

      if (version === 'v1beta') {
        body.systemInstruction = { parts: [{ text: system }] };
        body.generationConfig.responseMimeType = "application/json";
      } else {
        // v1 behavior: system instructions in text
        body.contents[0].parts[0].text = `System Instruction: ${system}\n\nUser Question: ${user}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return res;
    };

    let res = await fetchGemini(model, 'v1beta');
    
    // Fallback logic for any model failure (404/503/429)
    if (!res.ok) {
      const fallbacks = [
        { name: 'gemini-1.5-flash', ver: 'v1beta' },
        { name: 'gemini-1.5-flash', ver: 'v1' },
        { name: 'gemini-2.0-flash', ver: 'v1beta' },
        { name: 'gemini-1.5-flash-8b', ver: 'v1beta' },
        { name: 'gemini-2.5-flash', ver: 'v1beta' },
        { name: 'gemini-2.0-flash-exp', ver: 'v1beta' }
      ];

      for (const f of fallbacks) {
        // Skip if this is the exact combo we just tried that failed
        if (f.name === model && (f.ver === 'v1beta' || f.ver === 'v1')) continue;

        if (!res.ok) {
          console.warn(`Attempting fallback to ${f.name} on ${f.ver}...`);
          res = await fetchGemini(f.name, f.ver);
        }
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Gemini API Error (${res.status}): ${errBody.error?.message || res.statusText}`);
    }
    const data = await res.json();
    let text = data.candidates[0].content.parts[0].text;
    return ensureJson(text);
  }
  
  if (provider === 'OpenAI') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API Error (${res.status}): ${errBody.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return ensureJson(data.choices[0].message.content);
  }

  if (provider === 'Claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        system: system,
        messages: [{ role: 'user', content: user }],
        max_tokens: 2000
      })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Claude API Error (${res.status}): ${errBody.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return ensureJson(data.content[0].text);
  }

  throw new Error('Invalid or unknown API Key');
};
