const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const xpEl = document.getElementById("xp");
const clickedEl = document.getElementById("clicked");
const finishBtn = document.getElementById("finish");

let xp = 0;
let clicked = 0;

// Each bug = issue category
const bugTypes = [
  { label: "Slow service", emoji: "🐌" },
  { label: "Confusing UI", emoji: "🦗" },
  { label: "Payment issues", emoji: "🪳" },
  { label: "Crashes", emoji: "🦟" },
  { label: "Delays", emoji: "🐜" },
  { label: "Annoying pop-ups", emoji: "🪰" },
  { label: "Other", emoji: "🪲" }
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

let bugs = [];

function spawnBug(i) {
  const type = bugTypes[i];
  bugs.push({
    x: rand(40, canvas.width - 40),
    y: rand(40, canvas.height - 40),
    vx: rand(-1.2, 1.2),
    vy: rand(-1.0, 1.0),
    r: 20,
    type,
    alive: true
  });
}

// Spawn 7 bugs
for (let i = 0; i < 7; i++) spawnBug(i);

let clickedTypes = {};

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const b of bugs) {
    if (!b.alive) continue;

    const dx = mx - b.x;
    const dy = my - b.y;

    if (Math.sqrt(dx * dx + dy * dy) <= b.r) {
      if (b.type.label === "Other"){
        // const otherFeedback = prompt("Please describe the other issue(s) experienced:");
        // if (otherFeedback){
        //     clickedTypes["Other"] = (clickedTypes["Other"] || 0) + 1;
        //     clickedTypes["Other Details"] = otherFeedback;
        // }
        clickedTypes["Other"] = (clickedTypes["Other"] || 0) + 1;
      }else{
        clickedTypes[b.type.label] = (clickedTypes[b.type.label] || 0) + 1;
      }

      b.vx = 0;
      b.vy = 0;

      b.type.emoji = "💥";

      setTimeout(() => {
        b.alive = false;  // Mark the bug as clicked (dead) after a short delay
        clicked++;
        xpEl.textContent = xp;
        clickedEl.textContent = clicked;

        if (clicked === bugs.length) {
          submitFeedback();
        }
      }, 200);
      break;
    }
  }
});

function step() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const b of bugs) {
    if (!b.alive) continue;

    b.x += b.vx;
    b.y += b.vy;

    if (b.x < 20 || b.x > canvas.width - 20) b.vx *= -1;
    if (b.y < 40 || b.y > canvas.height - 20) b.vy *= -1;

    ctx.font = "48px system-ui";
    ctx.fillText(b.type.emoji, b.x - 24, b.y + 12);

    ctx.font = "16px system-ui";
    ctx.fillText(b.type.label, b.x - 30, b.y + 50);
  }

  requestAnimationFrame(step);
}

step();

finishBtn.addEventListener("click", async () => {
  // Call the submitFeedback function to manually submit feedback
  submitFeedback();
});

function submitFeedback() {
  const xpEarned = 20;

  if (clicked === 0) {
    alert("Please click at least one bug you experienced before submitting.");
    return;
  }

  // Send the additional "Other" details if they were provided
  if (clickedTypes["Other Details"]) {
    console.log("Additional feedback from Other:", clickedTypes["Other Details"]);
  }

  const payload = {
    type: "bug_game",
    xp_earned: xpEarned,
    payload: { clickedTypes }
  };

  fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then((res) => res.json())
  .then((data) => {
    if (data.ok) {
      alert("Feedback submitted automatically! XP saved.");
      window.location.href = "/"; // Redirect after submission
    } else {
      alert("Submission failed.");
    }
  })
  .catch((err) => {
    alert("Network error: " + err);
  });
}