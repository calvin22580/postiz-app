You are running round 6 of a blind preference test of brand design directions for **Kanosena**. Kanosena is a UK service for small businesses (1 to 20 staff). It reads a business's website, writes a week of social media posts with branded graphics, and the owner approves each one. Then Kanosena schedules the posts to Facebook, Instagram and LinkedIn. Its promise is "You approve. We handle the rest." It plans to charge £79, £149 or £299 a month.

## The material

- `/Users/calvinholloway/Developer/Kanosena design lab/round-6/boards/` holds one PNG per design direction: `d20`, `d23` and `d24`. Use every PNG in the folder. If you cannot open the images, use `/Users/calvinholloway/Developer/Kanosena design lab/round-6/kanosena-design-lab-round-6.pdf`, which has one board per page.
- Each board shows the same pieces: the mark, colours, type, a homepage, the app's weekly approval screen, the same screen on a phone, four sample customer posts, the moment of approving, and the voice.
- The bakery, estate agency, gym and heating firm are made-up sample customers. Their posts are in each customer's own colours and type. Judge how the Kanosena brand frames and presents those posts, not the sample businesses themselves.
- Judge each board only on what you see. A board does not earn points for its writing or its amount of detail.
- Open and look closely at every image before scoring it. Judge mainly what you see: the homepage, the app screen, the phone screen and how the customer's posts are presented. The written notes on each board explain intent. Do not reward a board for its writing.

## The personas

Fully become each persona in turn. These people are fictional.

**A. Priya, the owner-maker.** 38, owns a bakery-café in Leeds with 6 staff. Posts on Instagram from her phone between customers, often at 10pm. Uses Canva now and then. Wants her feed to feel as warm as her shop. Dislikes anything corporate or "techy" and worries about looking fake. £79 a month has to feel obviously worth it.

**B. Tom, the marketing all-rounder.** 29, marketing and office manager at a 15-person independent estate agency in Bristol. Runs social, the newsletter and website updates. Design-literate: follows design accounts and uses Canva Pro and CapCut. Has to show his boss results. Wants tools that make him look good and save hours. Rejects anything childish or templated.

**C. Jess, the freelance social media manager.** 33, based in Manchester, runs accounts for five local clients: a gym, a florist, a barber, a café and a dentist. Lives in Instagram, Canva and CapCut. Very sensitive to taste and trends. Needs every client to look different. Recommends tools to clients only if they make her look professional, and judges harshly anything that looks like a cheap AI tool.

**D. Graham, the sceptical owner.** 57, runs a family plumbing and heating firm in Kent with 8 staff. Rarely on social media himself. Values trust, clarity and not being made to feel stupid. Wants it done properly without fuss, and needs to understand straight away what to press.

## The criteria (score each 1 to 10)

These are the same criteria as earlier rounds, so the results can be compared.

| Key | Criterion | Weight |
|---|---|---|
| `memorable` | Stops me scrolling. I would remember it tomorrow. | 20% |
| `fit` | Feels made for a business like mine and the people I serve. | 20% |
| `worth_paying` | Looks like a service worth £79 to £299 a month. I'd trust it with my brand. | 20% |
| `creative` | Fun, creative energy that would make my content better. | 15% |
| `clarity` | On the app or phone screen I know straight away what to do. | 15% |
| `longevity` | Will still look good in 10 years, not a passing trend. | 10% |

Weighted total = the sum of each score times its weight, giving a number from 1 to 10.

## The procedure

1. Run **3 independent rounds for each persona** (12 runs in total).
2. For each run, write and use a small script to shuffle the board order with a fixed seed (`seed = round_number * 10 + persona_index`, persona_index A=1, B=2, C=3, D=4). Record the order you used.
3. In that order, look at each board and, as the persona:
   - score the six criteria;
   - write a `first_reaction` of one or two sentences in the persona's own voice;
   - say whether the customer's own brand stays clear of Kanosena's styling (`customer_brand_clear`: true or false);
   - name a `dealbreaker` if there is one, otherwise `null`.
   Score each board on its own before moving to the next, and do not go back and change earlier scores in the run.
4. At the end of each run, the persona ranks all three designs in order (`ranking`), names the one they would actually pay for (`would_pay_for`), and makes a forced choice for each of the three pairs (`head_to_head`): if only these two existed, which would they choose?
5. Save each run as `/Users/calvinholloway/Developer/Kanosena design lab/round-6/results-codex/{persona}-r{round}.json`, for example `A-r1.json`, in this shape:

The design ids below are placeholders; use the real ones.

```json
{
  "persona": "A",
  "round": 1,
  "order": ["dXX", "dYY", "dZZ"],
  "scores": {
    "dXX": {"memorable": 8, "fit": 6, "worth_paying": 7, "creative": 9, "clarity": 7, "longevity": 6, "weighted": 7.2,
            "first_reaction": "...", "customer_brand_clear": true, "dealbreaker": null}
  },
  "ranking": ["dYY", "dXX", "dZZ"],
  "would_pay_for": "dYY",
  "head_to_head": {"d20_vs_d23": "...", "d20_vs_d24": "...", "d23_vs_d24": "..."}
}
```

6. When all 12 runs are saved, write `/Users/calvinholloway/Developer/Kanosena design lab/round-6/score-codex.py` using only the Python standard library. It reads every JSON file in `/Users/calvinholloway/Developer/Kanosena design lab/round-6/results-codex/` and works out, for each design:
   - mean weighted score and its standard deviation across all runs;
   - mean weighted score for each persona;
   - mean rank by weighted score within each run;
   - number of runs where it was ranked first by weighted score, number of runs where the persona's own `ranking` put it first, and number of `would_pay_for` votes;
   - head-to-head wins against each of the other two designs, overall and for each persona;
   - number of runs where `customer_brand_clear` was true, and number of dealbreakers.
7. Run the script and write `/Users/calvinholloway/Developer/Kanosena design lab/round-6/results-codex/summary.md` with:
   - a ranking table of all designs with the numbers above;
   - **the winner, and whether the result is consistent**. It is consistent only if the same design has the highest mean weighted score **and** the most first-place runs **and** wins the majority of its head-to-head choices against each of the other two designs **and** is not ranked last by mean score for any persona. If not, say so plainly and say which design is closest;
   - a head-to-head table: for each pair, how many of the 12 runs chose each design, and how each persona split;
   - for each of the three designs, its main strengths and weaknesses, quoting the personas' first reactions;
   - for the winner, the specific changes that would still raise its score, and which persona each change helps.

## Rules

- Work only inside `/Users/calvinholloway/Developer/Kanosena design lab/round-6`. Only add files in its `results-codex/` folder and the single script `score-codex.py`. Do not touch any other folder on this Mac, including `/Users/calvinholloway/Developer/social media`, and do not run git.
- Do not read any other results folder in `/Users/calvinholloway/Developer/Kanosena design lab/round-6` or in any earlier round's folder. Each tester works blind.
- Do not invent facts about Kanosena beyond this prompt.
- Finish with the contents of `summary.md` in your final message.
