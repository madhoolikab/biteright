import json

import anthropic

from app.config import get_settings

WEEKLY_INSIGHT_PROMPT = """You are a supportive nutrition coach for {name}. Generate ONE brief, personalised weekly insight based on their tracking data.

Context:
{context}

Rules:
1. Keep it to 2-3 sentences maximum
2. Be conversational and warm, never clinical or preachy
3. Never use shame language. If they went over calories, frame it neutrally
4. Celebrate consistency ("5 out of 7 days logged" is great, not "you missed 2 days")
5. If protein is consistently low, suggest specific Indian vegetarian sources they're already eating (dal, paneer, curd, sprouts, chana) — not supplements or Western foods
6. If fibre is low, suggest adding a side of vegetables or switching to whole grains
7. Reference their actual foods when possible, not generic advice
8. If weight is trending in goal direction, acknowledge it simply
9. Under-eating is more concerning than over-eating — flag it gently if avg < 1200
10. Sign off warmly but briefly"""


async def generate_weekly_insight(
    name: str,
    context: dict,
) -> str:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = WEEKLY_INSIGHT_PROMPT.format(
        name=name,
        context=json.dumps(context, indent=2, default=str),
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6-20250516",
            max_tokens=200,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception:
        days = context.get("week_stats", {}).get("days_logged", 0)
        avg = context.get("week_stats", {}).get("avg_daily_calories", 0)
        target = context.get("week_stats", {}).get("target_calories", 0)
        return (
            f"You logged {days} out of 7 days this week. "
            f"Your average intake was ~{round(avg)} kcal against a target of {target} kcal."
        )
