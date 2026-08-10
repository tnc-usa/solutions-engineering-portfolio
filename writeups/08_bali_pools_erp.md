# I built the software for a job I had done myself

In 2016 I started a pool business with a pickup and a test kit. For the first stretch I was the
business. I did the diagnosis, I found the leaks, I did the repair, and then I wrote the quote,
took the signoff, raised the invoice, chased the payment and asked for the review.

Six months in, I started writing the software. Not because I was drowning, but because I could
already see what was going to drown me. It is called FLOW, for Field, Logistics, Operations,
Workforce, and it is the reason the business scaled at all.

By the end of that first stretch it was 6 weekly maintenance teams running multiple routes, each
doing between 12 and 25 pools a day, 2 repair teams that moved onto refurbishments and construction
through the winter, and a crew on refurbishments and hard landscaping. In 2021 I moved to Cape
Town, opened a new branch and built it a second time: 4 maintenance teams and 2 repair teams,
taking refurbishment work only from our own maintenance clients. We sold the business in 2024.

What follows is what I learned building a system for a job I was doing with my hands at the time.

## What was going to cap me

The failure modes in a service business are not dramatic. They are small and they repeat.

A technician finishes a pool and the readings are on a damp page in a truck. The customer, who is
usually at work, has no evidence anyone came at all. A repair gets diagnosed on Tuesday and the
quote goes out on Friday, by which time they have called somebody else. The month-to-month
contracts only get invoiced because a person remembered to do it. Parts, stock, requisitions, who
has which vehicle, who worked what hours: all of it lives in somebody's head or in a spreadsheet
that one person maintains and nobody else trusts.

None of that is difficult. All of it is relentless. Repetition, not difficulty, is what actually
caps a service business, and at six months I was personally doing every one of those things, which
is precisely why I could see them coming.

## Build it early, or retrofit it later

The timing turned out to matter more than anything I got right in the design.

At six months the business was small enough that I could hold all of it in my head, and everything
the system needed to model was in front of me, being done by me, that week. There was no archaeology
to do and nobody to interview. When I added a table I already knew what belonged in it, because I
had filled that information in on paper the day before.

That window closes. By the time a service business is genuinely painful to run, the processes have
set, people have built private workarounds, and half the knowledge you need lives with a technician
who has been there four years and does it differently from everyone else. Then you are not building
a system, you are reverse-engineering one from an operation that is already moving, while it moves.

So the software did not relieve the growth. It preceded it. Every team I added afterwards was
onboarded into something that already worked, which is the only reason adding them was quick.

## What I built

FLOW is an ERP on AppSheet, Google Apps Script and Google Sheets. It runs to 37 tables, 154
screens and 195 actions. FLOW Lite, 15 tables and 58 screens, is the stripped-down field version
that a technician actually carries on a phone.

Between them they cover the scheduling and the per-pool maintenance history, crews with time and
attendance, vehicles and assets, products, parts, suppliers and requisitions, service contracts,
and the whole quote-to-cash chain.

## The part that paid for itself

The documents. FLOW generates and sends them on its own: quotations, the repair report, the pool
service report and the garden service report that reach the client, progress reports, historical
reports, payment notices, quote accepted and quote declined notices, requisition reports, and
payslips. There is also a formal decline-to-quote path, because saying no quickly and on the
record is worth as much as saying yes.

In a business without it, every one of those is a person remembering.

The highest-value one by a distance is the service report that lands with the customer after every
single visit. Pool maintenance is close to invisible when it is done well. You arrive while they
are out, the water stays clear, and the only thing they reliably notice is the debit order. A
report after each visit turns an invisible service into a visible one, and on a month-to-month
contract that visibility is the product. Retention is not a marketing problem, it is a
"did they see you" problem.

## Being your own user beats a requirements document

I knew which fields mattered because I had stood at the pool.

Take the thing that looks least like software: finding a leak. It is tempting to call that judgment
and leave it with the person, and that instinct is exactly what keeps most field software shallow.
Leak detection is not judgment. It is a process of elimination. You rule out the causes you already
know about, you read what the water level itself is telling you, and you narrow it down.

So the front of that process went into the weekly maintenance form, as one question about the water
level with the answers a technician actually has:

- water level is correct
- routine top up, nothing unusual
- top up after backwash or vacuum to waste
- pool is overfilled, rectified with backwash or waste
- top up and escalate, the level is abnormally low for no apparent reason
- turn off the pump and escalate, the level is near or below the weir intake
- works order or leak detection in progress

Read that as a diagnostic rather than a dropdown. The first four eliminate every ordinary reason a
pool is down, including the one we caused ourselves by backwashing. The fifth is a finding: down,
and nothing explains it. The sixth is a different finding with a different urgency, because below
the weir intake the pump is about to run dry, which is why the instruction comes before the
escalation. The last is a state, so the same pool is not raised again every week while a works
order is already open.

That is what makes a technician useful in his first month. He cannot find a leak. He can answer
that question correctly on his first day, and answering it correctly is most of the value, because
it puts the right pool in front of the person who can find the leak, with the ordinary explanations
already ruled out and a week-by-week history of the level sitting behind it.

## Where I stopped on purpose

I never encoded the second half: pressure-testing the lines, dye at the fittings, the listening
gear. Partly that is because the technicians were trained on it and did not need a phone to tell
them how to do their job. Mostly it is because of something the software could have done and
should not.

A system that can narrow a leak can also print a location, and the moment it prints one you have
made a commitment. Open the ground and you often find the same line has failed in a second place,
or that the failure is progressive and what you found is one symptom of it. The customer does not
receive that as new information. He receives it as misdiagnosis, he refuses the change order, and
he is not entirely unreasonable, because your own system told him where the leak was.

So the automation stops at "escalate". Leak quotes were handled by people, in a meeting, after a
thorough survey had established the primary site, and the quote was then engineered to carry the
exposure of everything still unknown. That is a commercial decision rather than a technical one,
and it is the part I would defend hardest if someone asked why the clever bit stops where it does.

So the line worth drawing is not between judgment and repetition. It is between the part of an
expert process you should turn into a question and the part you should not, and the second is not
always the part you could not.

## Running it from somewhere else

For the last 12 to 18 months of trading we ran the company remotely. That was not the goal when I
started building. It was a consequence. Once the schedule, the field capture, the documents and
the money all moved through one system, being physically present stopped being the thing holding
the business together. We sold it, with its contracts, assets and staff, in October 2024.

## Honest limits

- It was built for exactly one business, mine, over several years, and it accreted. There are
  corners of FLOW that exist because of one bad week in 2019 and would not survive a redesign.
- Low-code was the right call at that size, not a universal one. AppSheet and Apps Script put a
  working system in a technician's hand quickly and cheaply. I would make the same call again for
  a business that size and a different one at ten times it.
- No code from FLOW appears in this repository. It is a large application built for one company
  rather than the client-agnostic tooling this repo publishes, so the writeup is prose only.
- It did not make me better at fixing pools. It made a size possible that I could never have
  reached by trying to be everywhere myself.

The best brief I have ever had for a piece of software was six months of doing the job by hand.
