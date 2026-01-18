const textEl = document.getElementById("text");
const outEl = document.getElementById("out");
const summarizeBtn = document.getElementById("summarize");
const submitBtn = document.getElementById("submit");

let lastResult = null;

summarizeBtn.addEventListener("click", async () => {
  outEl.textContent = "Summarizing...";
  lastResult = null;
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textEl.value })
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      outEl.innerHTML = "Error: " + (data.error || "Request failed");
      return;
    }

    // Two possible server responses:
    // 1) { ok: true, result: {...} }
    // 2) { ok: true, raw: "..." }  (fallback)
    
    //if (data.result) {
    //  lastResult = data.result;
    //  outEl.textContent = JSON.stringify(data.result, null, 2);
    if (data.result) {
        lastResult = data.result;

        const bullets = data.result.bullets || [];
        const sentiment = data.result.sentiment || "unknown";
        const tags = data.result.tags || [];

        let html = "<h4>Summary of your feedback</h4><ul>";
        for (const b of bullets) {
            html += `<li>${b}</li>`;
        }
        html += "</ul>";

        html += `<p><b>Overall sentiment:</b> ${sentiment}</p>`;
        html += `<p><b>Key themes:</b> ${tags.join(", ")}</p>`;

        outEl.innerHTML = html;
    } else {
      lastResult = { raw: data.raw };
      outEl.textContent = data.raw;
    }

    submitBtn.disabled = false;
  } catch (err) {
    outEl.textContent = "Network / server error: " + String(err);
  }
});

submitBtn.addEventListener("click", async () => {
  // Simple reward for giving written feedback
  const xpEarned = 15;

  const payload = {
    type: "ramble",
    xp_earned: xpEarned,
    payload: {
      text: textEl.value,
      ai: lastResult
    }
  };

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      alert("Submit failed: " + (data.error || "unknown error"));
      return;
    }

    alert("Submitted! XP saved.");
    window.location.href = "/";
  } catch (err) {
    alert("Network / server error: " + String(err));
  }
});