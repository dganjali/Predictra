// Simple subscribe client used by the static landing page.
// Sends POST /api/subscribe with JSON { email }
async function subscribe(email, formElements) {
  const endpoint = '/api/subscribe';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    return { ok: res.ok, json };
  } catch (err) {
    return { ok: false, json: { message: err.message || 'Network error' } };
  }
}

function wireSubscribe(formId, inputId, msgId, btnId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const input = document.getElementById(inputId);
  const msg = document.getElementById(msgId);
  const btn = document.getElementById(btnId);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value && input.value.trim();
    if (!email) return;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    const { ok, json } = await subscribe(email);
    if (ok) {
      msg.textContent = json.message || 'Thanks — you are subscribed!';
      msg.style.color = 'green';
      input.value = '';
    } else {
      msg.textContent = json.message || 'Could not subscribe — try again later.';
      msg.style.color = 'crimson';
    }
    btn.disabled = false;
    btn.textContent = btn.getAttribute('data-label') || 'Join our mailing list';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireSubscribe('subscribe-form', 'email', 'subscribe-msg', 'subscribe-btn');
  wireSubscribe('subscribe-form-2', 'email-2', 'subscribe-msg-2', 'subscribe-btn-2');
});
