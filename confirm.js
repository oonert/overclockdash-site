/* confirm.js: the hidden presale confirm page (confirm.html).
   The link in each confirm email carries the person's code: /confirm?k=CODE
   1. Look the code up:  GET  API?action=lookup&k=CODE
        -> { ok: true, truck: "1997 4Runner SR5", deadline: "2026-12-05", deadlineText: "December 5" }
        -> { ok: false }                      (unknown code)
   2. Send the answers:  POST API  (form-encoded, no preflight)
        action=confirm, k, want (Yes|No), deposit, truck, ship (US|Overseas), dongle, note, page
        -> { ok: true, onTime: true|false }  (the script decides on time from its own clock and the deadline)
        -> { ok: false, error: "bad_code" }
   All customer-facing words are the presale chat's (claude/PRESALE_COMMS_PLAN.md). Don't reword here. */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbxi-XidVNt5O5QgqWX2Q7AxgvgE4CeUgcNRVTkpfK_G4opo1XjTwOyEbTPtx3rodjcp6w/exec';
  var MSG = {
    held:     'Got it. Your place is held. I\'ll email you when your round opens.',
    late:     'Got it, you\'re on the list. I\'ll email you when your round opens.',
    overseas: 'Thanks! Overseas shipping isn\'t set up yet, so you\'re on the stand-by list. I\'ll email you as soon as it is.',
    off:      'You\'re off the list. Thanks for the interest. If you change your mind, you can sign up again at overclockdash.com.',
    badlink:  'This link didn\'t work. Reply to my email and I\'ll sort it out.',
    failed:   'Something went wrong saving your answers. Please try again in a minute, or reply to my email and I\'ll take care of it.'
  };
  var $ = function (id) { return document.getElementById(id); };
  var form = $('cf-form'), msg = $('cf-msg'), go = $('cf-go'), wait = $('cf-wait');
  if (!form) return;

  var k = (new URLSearchParams(location.search).get('k') || '').trim();

  function say(key, thanks) {
    msg.innerHTML = '';
    var p = document.createElement('p'); p.textContent = MSG[key]; msg.appendChild(p);
    var s = document.createElement('p'); s.textContent = thanks ? 'Thanks, Derek' : 'Derek'; msg.appendChild(s);
    msg.hidden = false;
  }
  function badLink() { wait.hidden = true; form.hidden = true; say('badlink', false); }

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }

  // "No" hides questions 2 to 5 and changes the button
  function syncWant() {
    var w = val('want');
    $('cf-yes').hidden = (w === 'No');
    go.textContent = (w === 'No') ? 'Take me off the list' : 'Confirm';
    go.disabled = !w;
  }
  form.addEventListener('change', syncWant);

  if (!/^[A-Za-z0-9_-]{4,64}$/.test(k)) { badLink(); return; }

  fetch(API + '?action=lookup&k=' + encodeURIComponent(k), { method: 'GET', redirect: 'follow' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.ok) { badLink(); return; }
      var when = d.deadlineText || fmtDate(d.deadline);
      if (when) { $('cf-date').textContent = when; $('cf-deadline').hidden = false; }
      if (d.truck) $('cf-truck').value = d.truck;
      wait.hidden = true; form.hidden = false; syncWant();
    })
    .catch(badLink);

  var busy = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var want = val('want'); if (!want || busy) return;
    busy = true; go.disabled = true; msg.hidden = true;
    var body = new URLSearchParams();
    body.set('action', 'confirm'); body.set('k', k); body.set('want', want);
    if (want === 'Yes') {
      body.set('deposit', val('deposit'));
      body.set('truck', $('cf-truck').value.trim());
      body.set('ship', val('ship'));
      body.set('dongle', val('dongle'));
    }
    body.set('note', $('cf-note').value.trim());
    body.set('page', 'confirm-1');
    fetch(API, { method: 'POST', body: body, redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        busy = false;
        if (d && d.ok) {
          form.hidden = true; $('cf-deadline').hidden = true;
          if (want === 'No') say('off', true);
          else if (val('ship') === 'Overseas') say('overseas', true);
          else say(d.onTime === false ? 'late' : 'held', true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (d && d.error === 'bad_code') { badLink(); }
        else { go.disabled = false; say('failed', false); }
      })
      .catch(function () { busy = false; go.disabled = false; say('failed', false); });
  });
})();
