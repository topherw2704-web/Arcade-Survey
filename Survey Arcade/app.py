import json
import os
from datetime import datetime
from flask import Flask, request, jsonify, render_template

# OpenAI (used only for ramble summarization)
from openai import OpenAI

app = Flask(__name__)
client = OpenAI()  # reads OPENAI_API_KEY from environment

DATA_FILE = os.path.join("data", "store.json")


def load_store():
    if not os.path.exists(DATA_FILE):
        return {"xp": 0, "level": 1, "submissions": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_store(store):
    os.makedirs("data", exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)


def calc_level(xp):
    level = 1
    xp_threshold = 100  # Starting threshold for level 1

    # Increase level thresholds based on the XP
    while xp >= level * xp_threshold:
        level += 1
    
    return level


@app.route("/")
def home():
    store = load_store()
    return render_template("index.html", store=store)


@app.route("/bug-game")
def bug_game():
    store = load_store()
    return render_template("bug_game.html", store=store)


@app.route("/ramble")
def ramble():
    store = load_store()
    return render_template("ramble.html", store=store)

@app.route("/snake")
def snake():
    store = load_store()
    return render_template("snake_fruit.html", store=store)


@app.route("/dashboard")
def dashboard():
    store = load_store()

    xp = store.get("xp", 0)
    level = store.get("level", 1)

    level_xp_threshold = 50

    current_level_xp = (level - 1) * level_xp_threshold  # XP required for the current level
    next_level_xp = level * level_xp_threshold  # XP required for the next level

    # Calculate the progress percentage
    if next_level_xp > current_level_xp:
        progress_percentage = ((xp - current_level_xp) / (next_level_xp - current_level_xp)) * 100
    else:
        progress_percentage = 0

    bug_counts = {}
    tag_counts = {}
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0, "unknown": 0}
    snake_first_choice_counts = {}   # counts what users ate FIRST (most satisfied)
    snake_last_choice_counts = {}    # counts what users ate LAST (least satisfied)
    snake_submissions = []

    type_names = {
    "bug_game": "D-bugs",
    "ramble": "Ramble",
    "snake_game": "Snake Survey"
    }

    for s in store.get("submissions", []):
        if s.get("type") == "bug_game":
            clicked_types = (s.get("payload") or {}).get("clickedTypes", {})
            for k, v in clicked_types.items():
                if k == "Other":
                    bug_counts[k] = bug_counts.get(k, 0) + 1
                else:
                    try:
                        bug_counts[k] = bug_counts.get(k, 0) + int(v)
                    except ValueError:
                        print(f"Skipping non-integer value for {k}: {v}")

        if s.get("type") == "ramble":
            ai = (s.get("payload") or {}).get("ai") or {}
            sentiment = (ai.get("sentiment") or "unknown").lower()
            if sentiment not in sentiment_counts:
                sentiment = "unknown"
            sentiment_counts[sentiment] += 1

            tags = ai.get("tags") or []
            for t in tags:
                tag_counts[t] = tag_counts.get(t, 0) + 1

        if s.get("type") == "snake_game":
            snake_submissions.append(s)

            ranking = s.get("payload") or []
            # ranking should be a list like:
            # [{"key":"service","label":"Service Quality","emoji":"🍎"}, ...]
            if isinstance(ranking, list) and len(ranking) > 0:
                first = ranking[0].get("label", "Unknown")
                last = ranking[-1].get("label", "Unknown")

                snake_first_choice_counts[first] = snake_first_choice_counts.get(first, 0) + 1
                snake_last_choice_counts[last] = snake_last_choice_counts.get(last, 0) + 1


    snake_first_top = sorted(snake_first_choice_counts.items(), key=lambda x: x[1], reverse=True)
    snake_last_top = sorted(snake_last_choice_counts.items(), key=lambda x: x[1], reverse=True)

    # ---- Sentiment bar calculation ----
    pos = sentiment_counts.get("positive", 0)
    neu = sentiment_counts.get("neutral", 0)
    neg = sentiment_counts.get("negative", 0)

    total_known = pos + neu + neg

    # Default: centered if no data
    if total_known == 0:
        sentiment_score = 50  # percent
        sentiment_label = "No data yet"
    else:
        # Score in [-1, +1]
        score = (pos - neg) / total_known

        # Map to [0, 100] for CSS
        sentiment_score = int(round((score + 1) * 50))

        if score > 0.25:
            sentiment_label = "Mostly Positive"
        elif score < -0.25:
            sentiment_label = "Mostly Negative"
        else:
            sentiment_label = "Mixed / Neutral"

    # Sort counts (highest first)
    bug_top = sorted(bug_counts.items(), key=lambda x: x[1], reverse=True)
    tag_top = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)

    return render_template(
        "dashboard.html",
        store=store,
        bug_top=bug_top[:8],
        tag_top=tag_top[:10],
        sentiment_counts=sentiment_counts,
        sentiment_score=sentiment_score,
        sentiment_label=sentiment_label,
        type_names=type_names,
        snake_first_top=snake_first_top[:5],
        snake_last_top=snake_last_top[:5],
        snake_submissions=snake_submissions[-5:]
    )


@app.route("/api/submit", methods=["POST"])
def api_submit():
    store = load_store()
    data = request.get_json(force=True)

    xp_earned = int(data.get("xp_earned", 0))
    store["xp"] += xp_earned
    store["level"] = calc_level(store["xp"])

    submission = {
        "time": datetime.utcnow().isoformat() + "Z",
        "type": data.get("type", "unknown"),
        "xp_earned": xp_earned,
        "payload": data.get("payload", {}),
    }

    store["submissions"].append(submission)
    save_store(store)

    return jsonify({"ok": True, "store": store})


# @app.route("/api/summarize", methods=["POST"])
# def api_summarize():
#     data = request.get_json(force=True)
#     text = (data.get("text") or "").strip()

#     if not text:
#         return jsonify({"ok": False, "error": "No text provided"}), 400

#     prompt = (
#         "You are an assistant converting messy customer feedback into structured insights.\n"
#         "Return JSON with keys: bullets (3-6 strings), sentiment (positive|neutral|negative), tags (3-6 strings).\n"
#         "Be concise and specific.\n\n"
#         f"Customer feedback:\n{text}\n"
#     )

#     response = client.responses.create(
#         model="gpt-4.1-mini",
#         input=prompt,
#     )

#     raw = response.output_text.strip()

#     try:
#         parsed = json.loads(raw)
#         return jsonify({"ok": True, "result": parsed})
#     except Exception:
#         return jsonify({"ok": True, "raw": raw})

@app.route("/api/snake-submit", methods=["POST"])
def api_snake_submit():
    store = load_store()
    data = request.get_json(force=True)

    xp_earned = data.get('xp_earned', 0)  # Receive the XP earned from the Snake game submission
    store["xp"] += xp_earned  # Add to the total XP
    store["level"] = calc_level(store["xp"])

    submission = {
        "time": datetime.utcnow().isoformat() + "Z",
        "type": "snake_game",
        "xp_earned": xp_earned,
        "payload": data.get("payload", {}),
    }

    store["submissions"].append(submission)
    save_store(store)

    return jsonify({"ok": True, "store": store})


@app.route("/api/summarize", methods=["POST"])
def api_summarize():
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"ok": False, "error": "No text provided"}), 400

    prompt = (
        "Convert the customer's feedback into STRICT JSON ONLY (no markdown, no backticks).\n"
        "Return a JSON object with keys:\n"
        "  bullets: array of 3-6 short strings\n"
        "  sentiment: one of positive, neutral, negative\n"
        "  tags: array of 3-6 short strings\n\n"
        f"Customer feedback:\n{text}\n"
    )

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt,
    )

    raw = response.output_text.strip()

    # ---- Clean common markdown wrappers like ```json ... ``` ----
    # Extract the JSON object by taking content between first { and last }
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw_json = raw[start:end+1]
    else:
        raw_json = raw  # fallback

    try:
        parsed = json.loads(raw_json)
        return jsonify({"ok": True, "result": parsed})
    except Exception:
        # If still not parseable, return raw for debugging
        return jsonify({"ok": True, "raw": raw})


if __name__ == "__main__":
    app.run(debug=True)