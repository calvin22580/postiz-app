# Kanosena design lab: Codex test prompt (round 3)

Copy everything below the line into a new Codex task on the repository
`calvin22580/postiz-app`, branch `claude/project-thread-g17jy9`.

---

You are running a blind preference test of brand design directions for **Kanosena**. Kanosena is a UK service for small businesses (1 to 20 staff). It reads a business's website, writes a week of social media posts with branded graphics, and the owner approves each one. Then Kanosena schedules the posts to Facebook, Instagram and LinkedIn. Its promise is "You approve. We handle the rest." It plans to charge £79, £149 or £299 a month.

## The material

- `ours/design-lab/round-3/boards/` holds one PNG per design direction, named `d01-...png` to `d15-...png`. Use every PNG in the folder. If you cannot open the images, use `ours/design-lab/round-3/kanosena-design-lab-round-3.pdf`, which has one board per page.
- Each board shows the same pieces, so the designs are comparable: the mark, colours, type, a homepage, the app's weekly approval screen, customer graphics, the moment of approving, and the voice.
- The bakery is a made-up sample customer, the same on every board.
- Open and look closely at every image before scoring it. Judge mainly what you see: the homepage, the app screen and the graphics. The written notes on each board explain intent. Do not reward a board for its writing, length or amount of detail.

## The personas

Fully become each persona in turn. These people are fictional.

**A. Priya, the owner-maker.** 38, owns a bakery-café in Leeds with 6 staff. Posts on Instagram from her phone between customers, often at 10pm. Uses Canva now and then. Wants her feed to feel as warm as her shop. Dislikes anything corporate or "techy" and worries about looking fake. £79 a month has to feel obviously worth it.

**B. Tom, the marketing all-rounder.** 29, marketing and office manager at a 15-person independent estate agency in Bristol. Runs social, the newsletter and website updates. Design-literate: follows design accounts and uses Canva Pro and CapCut. Has to show his boss results. Wants tools that make him look good and save hours. Rejects anything childish or templated.

**C. Jess, the freelance social media manager.** 33, based in Manchester, runs accounts for five local clients: a gym, a florist, a barber, a café and a dentist. Lives in Instagram, Canva and CapCut. Very sensitive to taste and trends. Needs every client to look different. Recommends tools to clients only if they make her look professional, and judges harshly anything that looks like a cheap AI tool.

**D. Graham, the sceptical owner.** 57, runs a family plumbing and heating firm in Kent with 8 staff. Rarely on social media himself. Values trust, clarity and not being made to feel stupid. Wants it done properly without fuss, and needs to understand straight away what to press.

## The criteria (score each 1 to 10)

| Key | Criterion | Weight |
|---|---|---|
| `memorable` | Stops me scrolling. I would remember it tomorrow. | 20% |
| `fit` | Feels made for a business like mine and the people I serve. | 20% |
| `worth_paying` | Looks like a service worth £79 to £299 a month. I'd trust it with my brand. | 20% |
| `creative` | Fun, creative energy that would make my content better. | 15% |
| `clarity` | On the app screen I know straight away what to do. | 15% |
| `longevity` | Will still look good in 10 years, not a passing trend. | 10% |

Weighted total = the sum of each score times its weight, giving a number from 1 to 10.

## The procedure

1. Run **3 independent rounds for each persona** (12 runs in total).
2. For each run, write and use a small script to shuffle the board order with a fixed seed (`seed = round_number * 10 + persona_index`, persona_index A=1, B=2, C=3, D=4). Record the order you used.
3. In that order, look at each board and, as the persona:
   - score the six criteria;
   - write a `first_reaction` of one or two sentences in the persona's own voice;
   - name a `dealbreaker` if there is one, otherwise `null`.
   Score each board on its own before moving to the next, and do not go back and change earlier scores in the run.
4. At the end of each run, the persona picks a `top_3` in order, and the one design they would actually pay for (`would_pay_for`).
5. Save each run as `ours/design-lab/results/round-3/{persona}-r{round}.json`, for example `A-r1.json`, in this shape:

```json
{
  "persona": "A",
  "round": 1,
  "order": ["d07", "d02"],
  "scores": {
    "d07": {"memorable": 8, "fit": 6, "worth_paying": 7, "creative": 9, "clarity": 7, "longevity": 6, "weighted": 7.2,
            "first_reaction": "...", "dealbreaker": null}
  },
  "top_3": ["d07", "d03", "d10"],
  "would_pay_for": "d07"
}
```

6. When all 12 runs are saved, write `ours/design-lab/score.py` using only the Python standard library. It reads every JSON file in `ours/design-lab/results/round-3/` and works out, for each design:
   - mean weighted score and its standard deviation across all runs;
   - mean weighted score for each persona;
   - mean rank by weighted score within each run;
   - number of runs where it was ranked first, number of `top_3` mentions and number of `would_pay_for` votes.
7. Run the script and write `ours/design-lab/results/round-3/summary.md` with:
   - a ranking table of all designs with the numbers above;
   - **the winner, and whether the result is consistent**. It is consistent only if the same design has the highest mean weighted score **and** the most first-place runs **and** is in the top 3 by mean score for every one of the four personas. If not, say so and name the top three to carry into the next round;
   - for the top five designs, their main strengths and weaknesses, quoting the personas' first reactions;
   - for the top three, specific changes that would raise their scores, and which persona each change helps.

## Rules

- Only add files under `ours/design-lab/results/` and the single script `ours/design-lab/score.py`. Change nothing else in the repository.
- Do not invent facts about Kanosena beyond this prompt.
- Finish with the contents of `summary.md` in your final message.
