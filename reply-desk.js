// Reply Desk - lightweight AI assistant client
const features = {
  answerEmail: {
    title: 'Answer an email',
    template: 'You are a helpful assistant. Draft a polite, concise reply to the following email:\n\n"{{input}}"\n\nInclude subject suggestions and 3 bullet points for follow-up.'
  },
  generateReport: {
    title: 'Generate a report',
    template: 'You are an analyst. Generate a short report with overview, key metrics, and 3 recommendations given the following notes:\n\n{{input}}'
  },
  summarizeMeeting: {
    title: 'Summarize a meeting',
    template: 'Summarize the meeting notes below into 5 concise bullet points and action items:\n\n{{input}}'
  },
  manageSchedule: {
    title: 'Manage schedules',
    template: 'Given the calendar notes and constraints below, propose a schedule and suggest best time slots:\n\n{{input}}'
  },
  createContent: {
    title: 'Create content',
    template: 'Create a short piece of content (blog intro, social post, or email) based on the brief:\n\n{{input}}\n\nDeliverables: title, 2-sentence intro, 3 hashtags.'
  },
  analyzeDocument: {
    title: 'Analyze a document',
    template: 'Analyze the document below. Provide summary, key claims, and a short critique:\n\n{{input}}'
  },
  automateSupport: {
    title: 'Automate customer support',
    template: 'Given these support conversation logs and product info, suggest canned responses, routing rules, and an escalation plan:\n\n{{input}}'
  },
  manageLeads: {
    title: 'Manage sales leads',
    template: 'You are a sales assistant. Given lead notes, suggest qualification questions, scoring, and next outreach steps:\n\n{{input}}'
  }
};

// Optional: hard-code your deployed proxy URL here (helpful for local Reply Desk proxy)
const DEFAULT_PROXY = 'http://localhost:3000';

const els = {};

function appendMessage(role, text) {
  const container = document.getElementById('messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

  const meta = document.createElement('div');
  meta.className = 'meta';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + (role === 'user' ? 'user' : 'ai');
  avatar.textContent = role === 'user' ? 'U' : 'AI';
  const time = document.createElement('div');
  const now = new Date();
  time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.appendChild(avatar);
  meta.appendChild(time);

  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = text;

  wrapper.appendChild(meta);
  wrapper.appendChild(body);
  // append hidden, then trigger entrance animation
  container.appendChild(wrapper);
  // force a reflow then add visible class to animate
  requestAnimationFrame(() => {
    wrapper.classList.add('visible');
    container.scrollTop = container.scrollHeight;
  });
}

function createTypingIndicator(){
  const container = document.getElementById('messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ai typing';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ai';
  avatar.textContent = 'AI';
  meta.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'body';
  const dots = document.createElement('div');
  dots.className = 'dots';
  for(let i=0;i<3;i++){ const d = document.createElement('div'); d.className='dot'; dots.appendChild(d);} 
  body.appendChild(dots);

  wrapper.appendChild(meta);
  wrapper.appendChild(body);
  container.appendChild(wrapper);
  requestAnimationFrame(()=> wrapper.classList.add('visible'));
  container.scrollTop = container.scrollHeight;
  return wrapper;
}

function removeTypingIndicator(el){
  try{ if(el && el.parentNode) el.parentNode.removeChild(el);}catch(e){}
}

async function callOpenAI(prompt, apiKey, model='gpt-3.5-turbo'){
  if(!apiKey) {
    // Stubbed response for offline/demo use
    await new Promise(r=>setTimeout(r,400));
    return 'Stubbed AI response:\n' + prompt.slice(0,100) + (prompt.length>100? '...':'' );
  }

  const body = {
    model,
    messages: [{role:'user', content: prompt}],
    max_tokens: 800,
    temperature: 0.2
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if(!res.ok){
    const txt = await res.text();
    throw new Error('OpenAI error: ' + res.status + ' ' + txt);
  }

  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

function renderFeaturePrompt(key, inputSample=''){
  const f = features[key];
  if(!f) return;
  const prompt = f.template.replace('{{input}}', inputSample || '[paste content here]');
  document.getElementById('featurePrompt').textContent = prompt;
}

async function runFeature(key, inputText){
  const feature = features[key];
  if(!feature) return;
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('modelSelect').value || 'gpt-3.5-turbo';
  const prompt = feature.template.replace('{{input}}', inputText || '');

  appendMessage('user', `${feature.title}: ${inputText || ''}`);
  // show typing indicator while we fetch
  const typingEl = createTypingIndicator();
  try{
    // Preference order:
    // 1) explicit proxy URL provided by user and enabled
    // 2) local server at /server
    // 3) direct OpenAI call using API key (or stub)
    let respText = '';
    const userProxy = (els.useProxy && els.useProxy.checked && els.proxyUrl && els.proxyUrl.value.trim()) ? els.proxyUrl.value.trim().replace(/\/$/, '') : null;

    if (userProxy) {
      try {
        const h = await fetch(userProxy + '/health');
        if (h.ok) {
          const r = await fetch(userProxy + '/api/chat', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ messages: [{role:'user', content: prompt}], model })
          });
          if (!r.ok) throw new Error('Proxy error '+r.status);
          const j = await r.json();
          respText = j.choices?.[0]?.message?.content || JSON.stringify(j);
        }
      } catch (e) {
        console.warn('User proxy failed:', e.message);
      }
    }

    if (!respText) {
      if (window.__aiProxyAvailable === undefined) {
        try{ const h = await fetch('/server/health'); window.__aiProxyAvailable = h.ok; }catch(e){ window.__aiProxyAvailable = false; }
      }
      if (window.__aiProxyAvailable) {
        const r = await fetch('/server/api/chat', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ messages: [{role:'user', content: prompt}], model })
        });
        if (!r.ok) throw new Error('Proxy error '+r.status);
        const j = await r.json();
        respText = j.choices?.[0]?.message?.content || JSON.stringify(j);
      }
    }

    if (!respText) {
      respText = await callOpenAI(prompt, apiKey, model);
    }

    removeTypingIndicator(typingEl);
    document.getElementById('lastResponse').textContent = respText;
    appendMessage('ai', respText);
  } catch(err) {
    removeTypingIndicator(typingEl);
    const msg = 'Error: ' + err.message;
    document.getElementById('lastResponse').textContent = msg;
    appendMessage('ai', msg);
  }
}

function init(){
  els.apiKey = document.getElementById('apiKey');
  els.clearKey = document.getElementById('clearKey');
  els.sendMessage = document.getElementById('sendMessage');
  els.clearChat = document.getElementById('clearChat');
  els.userInput = document.getElementById('userInput');
  els.lastResponse = document.getElementById('lastResponse');
  els.proxyUrl = document.getElementById('proxyUrl');
  els.useProxy = document.getElementById('useProxy');
  // prefill proxy input if DEFAULT_PROXY is set
  if (typeof DEFAULT_PROXY === 'string' && DEFAULT_PROXY.trim()) {
    els.proxyUrl.value = DEFAULT_PROXY.trim().replace(/\/$/, '');
    els.useProxy.checked = true;
  }

  document.querySelectorAll('.feature-btn').forEach(btn=>{
    const key = btn.dataset.feature;
    btn.addEventListener('click', ()=>{
      renderFeaturePrompt(key);
      // prefill composer with template placeholder
      const sample = '[Paste the email, notes, or document here]';
      els.userInput.value = ''; // let user paste
      // when user clicks the feature, if they press Send, run feature with textarea content
      // provide quick-run on double-click: if textarea has content, run immediately
      btn.addEventListener('dblclick', ()=>{
        runFeature(key, els.userInput.value || sample);
      }, {once:true});
    });

    // add ripple effect to buttons and pulse on send
    function addRipple(btn){
      btn.classList.add('ripple');
      btn.addEventListener('pointerdown', function(e){
        const rect = btn.getBoundingClientRect();
        const circle = document.createElement('div');
        circle.className = 'ripple-circle';
        const size = Math.max(rect.width, rect.height);
        circle.style.width = circle.style.height = size + 'px';
        circle.style.left = (e.clientX - rect.left - size/2) + 'px';
        circle.style.top = (e.clientY - rect.top - size/2) + 'px';
        btn.appendChild(circle);
        circle.addEventListener('animationend', ()=> circle.remove());
      });
    }

    document.querySelectorAll('button').forEach(b => addRipple(b));

    // send button pulse and keyboard shortcut (Ctrl+Enter)
    els.sendMessage.addEventListener('click', ()=>{
      els.sendMessage.classList.add('pulse');
      els.sendMessage.addEventListener('animationend', function t(){ els.sendMessage.classList.remove('pulse'); els.sendMessage.removeEventListener('animationend', t); });
    });

    document.addEventListener('keydown', (e)=>{
      if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault();
        els.sendMessage.click();
      }
    });
  });

  els.clearKey.addEventListener('click', ()=>{els.apiKey.value='';});
  els.clearChat.addEventListener('click', ()=>{document.getElementById('messages').innerHTML=''; els.lastResponse.textContent='No response yet.'});

  // Send on Enter (press Enter to send, Shift+Enter for newline)
  els.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      els.sendMessage.click();
    }
  });

  els.sendMessage.addEventListener('click', async ()=>{
    const text = els.userInput.value.trim();
    if(!text) return;
    // If the user has loaded a feature template in the preview, detect and run that feature automatically
    const featureText = document.getElementById('featurePrompt').textContent || '';
    const matched = Object.keys(features).find(k => features[k].template === featureText || featureText.startsWith(features[k].template.split('{{input}}')[0]));
    if(matched){
      await runFeature(matched, text);
    } else {
      appendMessage('user', text);
      const typingEl = createTypingIndicator();
      const apiKey = els.apiKey.value.trim();
      const model = document.getElementById('modelSelect').value || 'gpt-3.5-turbo';
      try{
        const resp = await callOpenAI(text, apiKey, model);
        removeTypingIndicator(typingEl);
        els.lastResponse.textContent = resp;
        appendMessage('ai', resp);
      }catch(err){
        removeTypingIndicator(typingEl);
        appendMessage('ai', 'Error: '+err.message);
      }
    }
    els.userInput.value='';
  });

}

window.addEventListener('DOMContentLoaded', init);
