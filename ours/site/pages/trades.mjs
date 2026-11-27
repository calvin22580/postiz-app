// OURS: content for the kanosena.com guide pages ("Social media for your
// trade"). build-pages.mjs turns this into static HTML under
// public/social-media-for/. Edit the words here, then run the build.
//
// Rules for this file (FORK_RULES.md, product rules):
// - Every example post is for a made-up business and is labelled as such.
// - No invented customers, testimonials, results or numbers about Kanosena.
// - Every rule that comes from a law or a regulator links to its source
//   (rules without a link are general good practice). Facts checked on
//   27/11/2026 (CHECKED below).
// - British English, DD/MM/YYYY. Text fields are plain text (escaped by the
//   build); fields ending in Html may contain inline HTML.

export const CHECKED = '27/11/2026';

// Example weeks use the week starting Monday 30/11/2026.

export const trades = [
  {
    slug: 'restaurants-and-cafes',
    name: 'Restaurants, cafés and pubs',
    short: 'Specials, bookings, events and the drinks advertising rules.',
    title: 'Social media for restaurants, cafés and pubs | Kanosena',
    description:
      'What to post, when to post it and the advertising rules worth knowing for UK restaurants, cafés and pubs. Plus how Kanosena writes a week of posts for you to approve.',
    eyebrow: 'For restaurants, cafés and pubs',
    h1Html: '<span class="hl">Social media</span> for restaurants, cafés and pubs',
    lede:
      'Before they book, plenty of people look you up on Instagram or Facebook. Here is what is worth posting through the year, the rules that apply to food and drink posts, and how Kanosena can write a week of posts from your own website for you to approve.',
    ideasIntro: 'Posts that give people a reason to visit, and a reason to come back.',
    ideas: [
      ['Specials and new dishes', 'Show the plate, say what is in it and when it is on. A weekly special gives people a reason to come back and a reason to follow you.'],
      ['Opening hours and changes', 'Bank holiday hours, a private event, a closed kitchen. Posting changes early saves wasted journeys and phone calls.'],
      ['The people behind the counter', 'Your chef, your barista, the Saturday team. Faces build trust faster than food photos alone. Ask before you post anyone.'],
      ['Booking reminders', 'Sunday lunch, Mothering Sunday, Christmas parties. Remind people early, with a clear way to book.'],
      ['Where your food comes from', 'The bakery that makes your bread, the farm behind your eggs. Only say it while it is true.'],
      ['Events and what is on', 'Quiz nights, live music, the big match, tasting evenings. Give the date, the time and whether people need to book.'],
    ],
    year: [
      ['January', 'Veganuary and Dry January: good months for plant-based dishes and alcohol-free drinks. Burns Night (25 January) matters most in Scotland.'],
      ['February and March', 'Valentine’s Day (14 February), Pancake Day (Shrove Tuesday), and the Six Nations for pubs that show the rugby.'],
      ['March or April', 'Mothering Sunday falls three weeks before Easter Sunday, and tables go quickly. Start reminding people two or three weeks ahead.'],
      ['May to August', 'Bank holiday weekends, outdoor seating, Father’s Day (the third Sunday in June) and the school holidays.'],
      ['September to November', 'Christmas party bookings start early. Halloween and Bonfire Night (5 November) suit themed menus and events.'],
      ['December', 'Opening hours over Christmas and New Year, gift vouchers, and last-minute tables.'],
    ],
    rules: [
      {
        h: 'Drinks posts have their own rules',
        p: 'The UK advertising code (the CAP Code, section 18) says alcohol marketing must not suggest that drinking makes people more confident or popular, must not encourage excessive drinking, and must not show anyone drinking who is, or looks, under 25.',
        src: ['CAP Code section 18: Alcohol (ASA)', 'https://www.asa.org.uk/advertising-codes/non-broadcast-html/section-18-alcohol.aspx'],
      },
      {
        h: 'Only say “gluten-free” if it is',
        p: 'Only food with 20 parts per million of gluten or less can be called gluten-free. If you can’t be sure a dish meets that, say what it leaves out instead of using the label.',
        src: ['Gluten and the law (Coeliac UK)', 'https://coeliac.org.uk/gluten-free-diet-and-lifestyle/food-shopping/law-on-gluten-free'],
      },
      {
        h: 'Offers must match the till',
        p: 'If a post mentions a deal or a price, say what it includes and when it ends, and make sure people pay what the post says.',
      },
      {
        h: 'Ask before you post people',
        p: 'Get a customer’s or a team member’s agreement before you post a photo of them, and take extra care with children.',
      },
    ],
    example: {
      label: 'Example café',
      cards: [
        { wh: 'Mon 30/11 · 08:00 · Instagram', ok: 'Goes out Mon 30/11 at 08:00', kick: 'From today', big: 'Mince pie season', cp: 'Mince pies are on the counter from today, made in our kitchen every morning. Grab one with your coffee on the way in.', src: 'Source: the “Christmas menu” page on your website', art: { bg: '#2E4B3C', fg: '#F6EFD9', acc: '#E9B949', font: 'Georgia,"Times New Roman",serif' } },
        { wh: 'Wed 02/12 · 12:00 · Facebook', kick: 'Book now', big: 'Weekday Christmas lunches', cp: 'We still have tables for Christmas lunch on weekdays in December. Book on our website or give us a ring.', src: 'Source: your “Book a table” page', art: { bg: '#F6EFD9', fg: '#2E4B3C', acc: '#B5492F', font: 'Georgia,"Times New Roman",serif' } },
        { wh: 'Fri 04/12 · 17:00 · Instagram', kick: 'Opening hours', big: 'Open till 9pm Fridays', cp: 'We are open until 9pm every Friday in December. Come in out of the cold.', src: 'Source: your opening hours page', art: { bg: '#E9B949', fg: '#2E4B3C', acc: '#2E4B3C', font: 'Georgia,"Times New Roman",serif' } },
      ],
    },
    faq: [
      ['Will you post offers or prices I haven’t mentioned?', 'No. Posts are written from what your own website says. If a price or an offer isn’t there, it won’t appear in a post. You can add details to your business profile at any time.'],
      ['Can I change a post before it goes out?', 'Yes. Edit any word, reject a post or ask for a new version. Only the posts you approve are scheduled, and you can change or cancel a scheduled post before it goes out.'],
      ['Do I need to take photos?', 'No. Each post comes with a simple branded graphic in your own colours, so you have something to post every week even when there is no time for photos.'],
    ],
  },

  {
    slug: 'hair-and-beauty-salons',
    name: 'Hair and beauty salons',
    short: 'Your work, free appointments, vouchers and the Botox advertising rule.',
    title: 'Social media for hair and beauty salons | Kanosena',
    description:
      'What to post through the year, the advertising rules that catch salons out, and how Kanosena writes a week of posts for UK hair salons, barbers, nail and beauty salons.',
    eyebrow: 'For hair salons, barbers, nail and beauty salons',
    h1Html: '<span class="hl">Social media</span> for hair and beauty salons',
    lede:
      'Your work is visual and your clients like to see it. Here is what to post through the year, the advertising rules that catch salons out, and how Kanosena can write a week of posts from your own website for you to approve.',
    ideasIntro: 'Posts that fill the book and keep clients coming back.',
    ideas: [
      ['Recent work, with permission', 'A fresh cut, a colour, a set of nails. Ask the client before you post, and say which service it was.'],
      ['Gaps in the book', 'A free slot on Thursday afternoon is worth a quick post. Give the day, the time and how to book.'],
      ['Meet the team', 'Introduce each stylist, barber or therapist: what they love doing and which days they work.'],
      ['Aftercare tips', 'How to keep a colour bright or make a blow-dry last. Useful posts get saved and shared.'],
      ['Services and prices', 'A clear reminder of what you offer and what it costs, kept in line with your website.'],
      ['Gift vouchers', 'Ahead of birthdays, Valentine’s Day, Mothering Sunday and Christmas.'],
    ],
    year: [
      ['January', 'New year, new look. Quieter weeks are a good time to promote services people have been putting off.'],
      ['February', 'Valentine’s Day (14 February): treatments and gift vouchers.'],
      ['March or April', 'Mothering Sunday, three weeks before Easter Sunday. Vouchers and treat days.'],
      ['May to August', 'Weddings, proms and holidays: bridal trials, summer nails, holiday-ready hair.'],
      ['September', 'Back to school and back to routine. Children’s cuts before term starts.'],
      ['November and December', 'Party season. Post your December hours early and remind people to book.'],
    ],
    rules: [
      {
        h: 'You can’t advertise Botox to the public',
        p: 'Botox and other anti-wrinkle injections are prescription-only medicines. The Advertising Standards Authority says these may not be advertised to the public, and its warnings have focused on social media. Its guidance explains what you can say about consultations instead.',
        src: ['Botox: frequently asked questions (ASA)', 'https://www.asa.org.uk/news/botox-frequently-asked-questions-faqs.html'],
      },
      {
        h: 'Results photos must be honest',
        p: 'Don’t use filters or edits that make a treatment look more effective than it is. Adverts, including your own posts, must not mislead.',
      },
      {
        h: 'Ask before you post a client',
        p: 'Get a client’s agreement before you post their photo, even if their face isn’t shown.',
      },
      {
        h: 'Prices and offers must be real',
        p: 'If a post mentions a price or a discount, it should match what clients pay and say when it ends.',
      },
    ],
    example: {
      label: 'Example salon',
      cards: [
        { wh: 'Mon 30/11 · 09:00 · Instagram', ok: 'Goes out Mon 30/11 at 09:00', kick: 'December', big: 'Book your party hair', cp: 'December fills up quickly. If you want your hair done for a Christmas do, book now so we can fit you in.', src: 'Source: your “Book online” page', art: { bg: '#1E1B2E', fg: '#F7E7E1', acc: '#E7A4B0', font: '"Didot","Bodoni MT",Georgia,serif' } },
        { wh: 'Wed 02/12 · 12:30 · Facebook', kick: 'Gift vouchers', big: 'Vouchers in any amount', cp: 'Gift vouchers are available in any amount, in the salon or online. An easy present for someone who deserves a treat.', src: 'Source: your “Gift vouchers” page', art: { bg: '#F7E7E1', fg: '#1E1B2E', acc: '#B0566A', font: '"Didot","Bodoni MT",Georgia,serif' } },
        { wh: 'Fri 04/12 · 18:00 · Instagram', kick: 'Aftercare', big: 'Keep your colour bright', cp: 'A quick tip from our colourists: wash with cooler water and a colour-safe shampoo to help your colour last.', src: 'Source: your “Colour” page', art: { bg: '#E7A4B0', fg: '#1E1B2E', acc: '#1E1B2E', font: '"Didot","Bodoni MT",Georgia,serif' } },
      ],
    },
    faq: [
      ['Will you mention treatments I don’t offer?', 'No. Posts are written from your own website and the business profile you check. If a treatment isn’t there, it won’t appear in a post.'],
      ['Will you use photos of my clients?', 'No. Each post comes with a simple branded graphic in your colours. If you post photos of clients yourself, get their agreement first.'],
      ['Can I stop a post at the last minute?', 'Yes. You can change or cancel a scheduled post at any time before it goes out.'],
    ],
  },

  {
    slug: 'tradespeople',
    name: 'Plumbers, electricians and builders',
    short: 'Finished jobs, seasonal reminders and the rules on logos and reviews.',
    title: 'Social media for tradespeople | Kanosena',
    description:
      'What to post, what not to claim and when, for UK plumbers, electricians, heating engineers, builders and roofers. Plus how Kanosena writes your posts for you to approve.',
    eyebrow: 'For plumbers, electricians, heating engineers, builders and roofers',
    h1Html: '<span class="hl">Social media</span> for plumbers, electricians and builders',
    lede:
      'Most of your work comes from word of mouth, and people look you up before they ring. A steady, honest social media presence backs that up. Here is what to post, what not to claim, and how Kanosena can do the writing for you.',
    ideasIntro: 'Posts that show you are local, reliable and good at what you do.',
    ideas: [
      ['Finished jobs, with the customer’s agreement', 'Before and after photos, what the problem was and how you fixed it. Leave out house numbers, number plates and anything that shows where someone lives.'],
      ['Seasonal reminders', 'Boiler services before winter, gutters after the leaves fall, outdoor work in spring.'],
      ['Where you work', 'The towns and areas you cover, so the right people know you are local.'],
      ['Your registrations', 'Say which schemes you belong to, if you belong to them, and link to your listing.'],
      ['Simple how-tos', 'How to bleed a radiator, find the stopcock or reset a tripped switch. Useful posts get shared.'],
      ['When you are booked up or free', 'Short-notice gaps, holiday dates and when you are back.'],
    ],
    year: [
      ['January and February', 'Cold snaps bring frozen pipes and boiler breakdowns. Practical tips earn trust.'],
      ['March to May', 'Spring is when people plan extensions, gardens, decorating and outdoor work.'],
      ['June to August', 'Good weather for roofing and exterior work, and for getting quotes in before autumn.'],
      ['September', 'Gas Safety Week runs each September: a good moment for safety reminders if you are Gas Safe registered.'],
      ['October and November', 'Boiler services before winter, gutter checks, and bleeding radiators when the heating goes on.'],
      ['December', 'Christmas hours, emergency cover, and when you are back after the holidays.'],
    ],
    rules: [
      {
        h: 'Only show logos you are entitled to',
        p: 'It is against the law to display a trust mark, quality mark or membership logo you aren’t authorised to use, or to claim an approval you don’t have. Trading Standards’ guidance singles out the Gas Safe logo.',
        src: ['Membership logos and claims of approval (Business Companion)', 'https://businesscompanion.info/en/quick-guides/fair-trading/membership-logos-and-claims-of-approval'],
      },
      {
        h: 'Gas work needs Gas Safe registration',
        p: 'Engineers doing gas work in people’s homes must be on the Gas Safe Register, the only scheme approved under the Gas Safety (Installation and Use) Regulations 1998.',
        src: ['Membership logos and claims of approval (Business Companion)', 'https://businesscompanion.info/en/quick-guides/fair-trading/membership-logos-and-claims-of-approval'],
      },
      {
        h: 'Reviews must be real',
        p: 'The Digital Markets, Competition and Consumers Act 2024 bans fake reviews and publishing reviews in a misleading way, such as hiding negative ones. Share genuine reviews, with the customer’s permission.',
        src: ['Reviews and endorsements (Business Companion)', 'https://www.businesscompanion.info/en/quick-guides/digital/reviews-and-endorsements'],
      },
      {
        h: 'Say what a price includes',
        p: 'If you mention a price, say whether it includes VAT, parts and call-out, so it matches what people pay.',
      },
    ],
    example: {
      label: 'Example heating engineer',
      cards: [
        { wh: 'Mon 30/11 · 07:30 · Facebook', ok: 'Goes out Mon 30/11 at 07:30', kick: 'Winter', big: 'Boiler playing up?', cp: 'Cold mornings are when boilers show they need attention. We still have service slots in December, so give us a call to book yours.', src: 'Source: your “Boiler servicing” page', art: { bg: '#0E3B66', fg: '#FFFFFF', acc: '#FF8A00', font: '"Arial Narrow","Roboto Condensed",Arial,sans-serif', weight: 800, upper: true } },
        { wh: 'Wed 02/12 · 12:00 · Facebook', kick: 'Quick tip', big: 'Find your stopcock', cp: 'Do you know where your stopcock is? It is often under the kitchen sink. Finding it now saves a panic if a pipe ever bursts.', src: 'Source: your “Emergency plumbing” page', art: { bg: '#FFFFFF', fg: '#0E3B66', acc: '#FF8A00', font: '"Arial Narrow","Roboto Condensed",Arial,sans-serif', weight: 800, upper: true } },
        { wh: 'Fri 04/12 · 17:00 · Instagram', kick: 'Christmas', big: 'On call for emergencies', cp: 'We are on call for heating and plumbing emergencies over Christmas. Our holiday hours are on our website.', src: 'Source: your “Opening hours” page', art: { bg: '#FF8A00', fg: '#0E3B66', acc: '#0E3B66', font: '"Arial Narrow","Roboto Condensed",Arial,sans-serif', weight: 800, upper: true } },
      ],
    },
    faq: [
      ['I’m out on jobs all day. How much time does this take?', 'Only one step needs you: reading the week’s posts, changing anything you want and approving them. We schedule them for the right times.'],
      ['Will you say I’m registered with a scheme?', 'Only if your website says so. Posts are written from your own website, and you check every post before it goes out.'],
      ['Can I post to my business Facebook Page?', 'Yes. We post to Facebook Pages, Instagram business accounts and LinkedIn Pages, not personal profiles.'],
    ],
  },

  {
    slug: 'estate-agents',
    name: 'Estate and letting agents',
    short: 'Listings, local guides and the material information rules.',
    title: 'Social media for estate agents | Kanosena',
    description:
      'What to post, when to post it and the material information rules for property posts, for UK estate and letting agents. Plus how Kanosena writes a week of posts for you to approve.',
    eyebrow: 'For estate and letting agents',
    h1Html: '<span class="hl">Social media</span> for estate and letting agents',
    lede:
      'Your listings live on the portals, but your social media shows sellers and landlords who you are. Here is what to post through the year, the material information rules for property posts, and how Kanosena can write a week of posts from your own website for you to approve.',
    ideasIntro: 'Posts that win valuations and instructions, not just likes.',
    ideas: [
      ['New listings and price changes', 'Include the price or rent, the council tax band and the tenure, so the post works as a proper listing.'],
      ['Sold and let agreed', 'A simple “sold” or “let agreed” post shows you are busy. Never share buyers’ or tenants’ details.'],
      ['Local area guides', 'Schools, parks, transport, the high street. Help people picture living there.'],
      ['Market updates', 'Plain-English updates on what is happening locally, using figures you can source.'],
      ['Meet the team', 'Who will value the home, show buyers round and answer the phone.'],
      ['Tips for sellers and landlords', 'Getting ready for viewings, what an EPC is, what landlords need to know when rules change.'],
    ],
    year: [
      ['January', 'New year, new move. People start looking and booking valuations.'],
      ['March to May', 'Gardens look their best: good for listings, valuations and moving guides.'],
      ['June to August', 'Families want to move before the new school year starts in September.'],
      ['September to November', 'The last chance to move before Christmas. Use your own figures on how long sales are taking.'],
      ['December', 'Office hours over Christmas, and a look back at your year.'],
      ['When rules change', 'Changes to Stamp Duty or to renting law (such as the Renters’ Rights Act in England) are good moments for a clear explainer.'],
    ],
    rules: [
      {
        h: 'Property posts need material information',
        p: 'National Trading Standards says agents must not leave material information out of property listings. “Part A” information (the price or rent, the council tax band or rate, and tenure for sales) is always material. Treat a post about a specific property as a listing, and include these there too.',
        src: ['Material information guidance (National Trading Standards)', 'https://www.nationaltradingstandards.uk/news/full-material-information-guidance-published/'],
      },
      {
        h: 'Reviews must be real',
        p: 'The Digital Markets, Competition and Consumers Act 2024 bans fake reviews and publishing reviews in a misleading way, such as hiding negative ones. Share genuine reviews, with the client’s permission.',
        src: ['Reviews and endorsements (Business Companion)', 'https://www.businesscompanion.info/en/quick-guides/digital/reviews-and-endorsements'],
      },
      {
        h: 'Back up every claim',
        p: '“Number one agent in town” or “we sell in half the time” needs evidence you can show. Claims you can’t back up count as misleading advertising.',
      },
      {
        h: 'Protect clients’ privacy',
        p: 'Don’t share details about buyers, tenants or agreed prices that your clients haven’t agreed to share.',
      },
    ],
    example: {
      label: 'Example estate agency',
      cards: [
        { wh: 'Mon 30/11 · 08:30 · Facebook', ok: 'Goes out Mon 30/11 at 08:30', kick: 'Just listed', big: '3-bed semi near the station', cp: 'Just listed: a three-bedroom semi-detached house close to the station. £325,000, council tax band C, freehold. Full details and viewings on our website.', src: 'Source: the listing on your website', art: { bg: '#1C2B4A', fg: '#F7F5F0', acc: '#C9A45C', font: 'Georgia,"Times New Roman",serif', italic: true } },
        { wh: 'Wed 02/12 · 12:00 · LinkedIn', kick: 'For landlords', big: 'Renting rules are changing', cp: 'Renting rules in England are changing. We have written a plain-English guide for landlords on our website, and we are happy to talk it through.', src: 'Source: your “Landlord news” page', art: { bg: '#F7F5F0', fg: '#1C2B4A', acc: '#9C7B3C', font: 'Georgia,"Times New Roman",serif', italic: true } },
        { wh: 'Fri 04/12 · 17:30 · Instagram', kick: 'Thinking of moving?', big: 'Book a free valuation', cp: 'Thinking about a move in the new year? Book a free valuation and we will tell you what your home could sell for.', src: 'Source: your “Valuations” page', art: { bg: '#C9A45C', fg: '#1C2B4A', acc: '#1C2B4A', font: 'Georgia,"Times New Roman",serif', italic: true } },
      ],
    },
    faq: [
      ['Do you replace the property portals?', 'No. The portals are where buyers and tenants search. Kanosena keeps your own Facebook, Instagram and LinkedIn pages active with posts you approve.'],
      ['Will you make claims about our results?', 'No. Posts are written from what your own website says. We don’t invent figures, reviews or awards.'],
      ['Do you post to LinkedIn too?', 'Yes. We post to LinkedIn Pages as well as Facebook Pages and Instagram business accounts, so landlords and local businesses see you as well as home movers.'],
    ],
  },

  {
    slug: 'accountants',
    name: 'Accountants and bookkeepers',
    short: 'Tax deadlines, Making Tax Digital and how you describe your firm.',
    title: 'Social media for accountants | Kanosena',
    description:
      'The tax dates worth posting about, what to post and the rules on describing your firm, for UK accountants and bookkeepers. Plus how Kanosena writes your posts for you to approve.',
    eyebrow: 'For accountants and bookkeepers',
    h1Html: '<span class="hl">Social media</span> for accountants and bookkeepers',
    lede:
      'Your clients don’t need more jargon. They need reminders at the right time from someone they trust. Here are the dates that matter, what to post, the rules on how you describe your firm, and how Kanosena can write your posts for you to approve.',
    ideasIntro: 'Posts that keep you in mind when a deadline comes round.',
    ideas: [
      ['Deadline reminders', 'Self Assessment, payments on account, VAT and year end. Post early, then again close to the date.'],
      ['What has changed', 'New thresholds, Making Tax Digital, Budget announcements. A short, plain explanation and an offer to help.'],
      ['Meet the team', 'Who clients will speak to, and what each person looks after.'],
      ['One service at a time', 'Payroll, bookkeeping, company formation, tax returns. One clear post for each.'],
      ['Simple tips', 'Keeping receipts, separating business and personal spending, which records to keep.'],
      ['Office news', 'New starters, exams passed, opening hours over the holidays.'],
    ],
    yearIntro: 'Self Assessment dates from GOV.UK.',
    year: [
      ['31 January', 'Deadline for online Self Assessment returns and paying tax owed for the previous tax year, and the first payment on account. Remind people from December.'],
      ['5 and 6 April', 'The tax year ends on 5 April and the new one starts on 6 April.'],
      ['31 July', 'Second payment on account for Self Assessment.'],
      ['5 October', 'Deadline to register for Self Assessment for anyone who needs to send a return for the first time.'],
      ['31 October', 'Deadline for paper Self Assessment returns.'],
      ['Making Tax Digital', 'Sole traders and landlords join Making Tax Digital for Income Tax based on their qualifying income in an earlier tax year: over £50,000 from 6 April 2026, over £30,000 from 6 April 2027 and over £20,000 from 6 April 2028.'],
    ],
    yearSrc: [
      ['Self Assessment deadlines (GOV.UK)', 'https://www.gov.uk/self-assessment-tax-returns/deadlines'],
      ['When to sign up for Making Tax Digital for Income Tax (GOV.UK)', 'https://www.gov.uk/guidance/check-when-to-sign-up-for-making-tax-digital-for-income-tax'],
    ],
    rules: [
      {
        h: '“Chartered Accountants” is a controlled description',
        p: 'ICAEW and the other institutes have regulations on which firms may describe themselves as “Chartered Accountants”. Posts are written from your website, so they describe your firm the way your website does.',
        src: ['Regulations on the “Chartered Accountants” description (ICAEW)', 'https://www.icaew.com/regulation/regulations-governing-the-use-of-the-description-of-chartered-accountants'],
      },
      {
        h: 'Check dates and figures at the source',
        p: 'Tax dates and thresholds change. Check them against GOV.UK before a post goes out.',
        src: ['Self Assessment deadlines (GOV.UK)', 'https://www.gov.uk/self-assessment-tax-returns/deadlines'],
      },
      {
        h: 'Keep public posts general',
        p: 'Explain rules in general terms and invite people to get in touch, rather than telling individuals what to do in a public post.',
      },
      {
        h: 'Client confidentiality',
        p: 'Never name a client or mention their figures without their written permission.',
      },
    ],
    example: {
      label: 'Example accountancy firm',
      cards: [
        { wh: 'Mon 30/11 · 08:00 · LinkedIn', ok: 'Goes out Mon 30/11 at 08:00', kick: 'Self Assessment', big: 'Two months to 31 January', cp: 'The online Self Assessment deadline is 31/01/2027. If you would like us to do your return, send us your records before Christmas and we will take it from there.', src: 'Source: your “Self Assessment” page', art: { bg: '#0F3D3A', fg: '#FFFFFF', acc: '#7FD1AE', font: '"Helvetica Neue",Arial,sans-serif', weight: 700 } },
        { wh: 'Wed 02/12 · 12:00 · Facebook', kick: 'Making Tax Digital', big: 'Over £30,000? April 2027', cp: 'Sole trader or landlord with qualifying income over £30,000 in the 2025 to 2026 tax year? Making Tax Digital for Income Tax applies to you from April 2027. We can help you get set up.', src: 'Source: your “Making Tax Digital” page', art: { bg: '#FFFFFF', fg: '#0F3D3A', acc: '#2A8C69', font: '"Helvetica Neue",Arial,sans-serif', weight: 700 } },
        { wh: 'Fri 04/12 · 16:00 · Instagram', kick: 'Quick tip', big: 'Snap every receipt', cp: 'Take a photo of each business receipt as you go. It makes your tax return much quicker to put together.', src: 'Source: your “Bookkeeping” page', art: { bg: '#7FD1AE', fg: '#0F3D3A', acc: '#0F3D3A', font: '"Helvetica Neue",Arial,sans-serif', weight: 700 } },
      ],
    },
    faq: [
      ['Is LinkedIn included?', 'Yes. We post to LinkedIn Pages as well as Facebook Pages and Instagram business accounts. LinkedIn suits business clients, and Facebook suits local ones.'],
      ['Will posts give tax advice?', 'Posts explain dates and changes in general terms, written from your own website, and invite people to get in touch. You approve every post before it goes out.'],
      ['Can I add my own news?', 'Yes. You can edit any post, and the business profile we write from can be updated at any time.'],
    ],
  },

  {
    slug: 'dental-practices',
    name: 'Dental practices',
    short: 'New patients, oral health tips and what the GDC expects.',
    title: 'Social media for dental practices | Kanosena',
    description:
      'What to post through the year and what the GDC expects from dental advertising, for UK dental practices. Plus how Kanosena writes a week of posts for you to approve.',
    eyebrow: 'For dental practices',
    h1Html: '<span class="hl">Social media</span> for dental practices',
    lede:
      'Patients want to know who they will see, what to expect and whether you are taking on new patients. Here is what to post through the year, what the General Dental Council expects from dental advertising, and how Kanosena can write your posts for you to approve.',
    ideasIntro: 'Calm, useful posts that help patients choose you and feel at ease.',
    ideas: [
      ['Whether you are taking new patients', 'NHS or private, adults or children. Keep it up to date.'],
      ['Meet the team', 'Dentists, hygienists, nurses and reception. Use titles exactly as registered.'],
      ['What to expect', 'A first check-up, a hygiene appointment, what happens in an emergency. Plain posts help nervous patients.'],
      ['Oral health tips', 'Brushing, sugar, children’s teeth. Useful, easy to share and low risk.'],
      ['Opening hours and emergencies', 'Bank holidays, Christmas, and who to call when you are closed.'],
      ['Treatments you offer', 'What a treatment involves and who it may suit, without promising results.'],
    ],
    year: [
      ['January', 'New year check-ups and practice payment plans, if you offer them.'],
      ['May and June', 'National Smile Month, run by the Oral Health Foundation, usually from mid-May to mid-June.'],
      ['July and August', 'Children’s appointments before school goes back.'],
      ['October', 'Halloween sweets and children’s teeth.'],
      ['November', 'Mouth Cancer Action Month, also run by the Oral Health Foundation: a good time to explain what you check for.'],
      ['December', 'Christmas opening hours and emergency arrangements.'],
    ],
    rules: [
      {
        h: 'Only specialists say “specialist”',
        p: 'The GDC says only dentists on one of its specialist lists may call themselves specialists. Others must not use titles that imply it, such as orthodontist or periodontist.',
        src: ['Guidance on advertising (General Dental Council)', 'https://www.gdc-uk.org/standards-guidance/standards-and-guidance/gdc-guidance-for-dental-professionals/guidance-on-advertising'],
      },
      {
        h: 'Don’t promise results',
        p: 'The GDC says advertising must not mislead or create an unjustified expectation about results. When you promote a treatment on social media, make clear it may not suit every patient.',
        src: ['Guidance on advertising (General Dental Council)', 'https://www.gdc-uk.org/standards-guidance/standards-and-guidance/gdc-guidance-for-dental-professionals/guidance-on-advertising'],
      },
      {
        h: 'Show GDC numbers',
        p: 'The GDC expects advertising to include the dental professional’s GDC registration number, including on websites where they are named.',
        src: ['Guidance on advertising (General Dental Council)', 'https://www.gdc-uk.org/standards-guidance/standards-and-guidance/gdc-guidance-for-dental-professionals/guidance-on-advertising'],
      },
      {
        h: 'No advertising prescription-only medicines',
        p: 'Anti-wrinkle injections such as Botox are prescription-only medicines and can’t be advertised to the public, including on social media.',
        src: ['Botox: frequently asked questions (ASA)', 'https://www.asa.org.uk/news/botox-frequently-asked-questions-faqs.html'],
      },
    ],
    example: {
      label: 'Example dental practice',
      cards: [
        { wh: 'Mon 30/11 · 08:00 · Facebook', ok: 'Goes out Mon 30/11 at 08:00', kick: 'New patients', big: 'Now taking new patients', cp: 'We are taking on new private patients for check-ups and hygiene appointments. Find out more and book on our website.', src: 'Source: your “New patients” page', art: { bg: '#E9F4F7', fg: '#0B4F6C', acc: '#20A4C4', font: '"Trebuchet MS","Segoe UI",sans-serif', weight: 700 } },
        { wh: 'Wed 02/12 · 12:30 · Instagram', kick: 'Healthy teeth', big: 'Two minutes, twice a day', cp: 'Brushing for two minutes, twice a day, with a fluoride toothpaste is one of the simplest things you can do for your teeth.', src: 'Source: your “Looking after your teeth” page', art: { bg: '#0B4F6C', fg: '#FFFFFF', acc: '#7FD8EA', font: '"Trebuchet MS","Segoe UI",sans-serif', weight: 700 } },
        { wh: 'Fri 04/12 · 17:00 · Facebook', kick: 'Christmas', big: 'Our holiday opening hours', cp: 'Our Christmas and New Year opening hours are on our website, along with who to call if you need urgent care while we are closed.', src: 'Source: your “Opening hours” page', art: { bg: '#20A4C4', fg: '#FFFFFF', acc: '#0B4F6C', font: '"Trebuchet MS","Segoe UI",sans-serif', weight: 700 } },
      ],
    },
    faq: [
      ['Will posts call our dentists specialists?', 'Only if your website does. Posts are written from your own website, and you check every post before it goes out.'],
      ['Will you post before-and-after photos?', 'No. Each post comes with a simple branded graphic in your colours. We don’t create or alter clinical photos.'],
      ['Which platforms do you post to?', 'Facebook Pages, Instagram business accounts and LinkedIn Pages for now. Personal profiles aren’t supported.'],
    ],
  },
];

// The hub page at /social-media-for/
export const hub = {
  title: 'Social media guides for UK small businesses | Kanosena',
  description:
    'Practical social media guides for UK small businesses: what to post, when, and the rules worth knowing for restaurants, salons, tradespeople, estate agents, accountants and dental practices.',
  eyebrow: 'Guides for UK small businesses',
  h1Html: '<span class="hl">Social media</span> for your trade',
  lede:
    'What to post, when to post it, and the rules worth knowing in your line of work. Each guide also shows how Kanosena can write a week of posts from your own website for you to approve.',
};
