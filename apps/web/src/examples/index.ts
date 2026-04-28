export interface Example {
  name: string
  content: string
}

export const EXAMPLES: Example[] = [
  {
    name: 'Simple flow',
    content: `lr
start((Start))~green->process(Process)->end((End))~red`,
  },
  {
    name: 'Architecture',
    content: `td
browser(Browser)~blue->{cdn:CDN,api(API Gateway)~purple}
api->db[(Database)]~orange|query
api=>cache[(Redis Cache)]~red|lookup
[Backend: api db cache]`,
  },
  {
    name: 'Decision flow',
    content: `td
start(Push to main)->tests{Tests pass?}
tests->deploy(Deploy to prod)~green|yes
tests=>notify(Notify team)~red|no`,
  },
  {
    name: 'All shapes',
    content: `lr
b:Box
r(Rounded)
c((Circle))
d{Diamond}
y[(Cylinder)]
p:Parallel
h:Hexagon`,
  },
  {
    name: 'Sequence branching',
    content: `sequence wrap=3 snake=horizontal rowgap=100 colgap=26
phase intake:Intake and triage
intake:Intake->draft:Draft
fork draft -> legal:Legal Review, security:Security Review
lane release:Release lane
join legal, security -> approve:Approve
approve->ship:Ship
note right of approve:Final sign-off\\nand release window
note over security:Parallel checks stay visible`,
  },
  {
    name: 'Chart area',
    content: `chart
style blueprint
kind area
title Revenue Trend
xlabel Month
ylabel Revenue
legend bottom
grid both
points hide
yticks 6
ymin 0
ymax 40
categories Jan, Feb, Mar, Apr
series Actual: 12, 18, 24, 30
series Plan: 10, 16, 22, 28`,
  },
  {
    name: 'Chart stacked',
    content: `chart
style architect
kind bar
stack stacked
title Revenue Mix by Quarter
ylabel Revenue
legend top
grid y
categories Q1, Q2, Q3, Q4
series Product: 12, 16, 18, 22
series Services: 8, 9, 11, 14
series Support: 4, 5, 6, 7`,
  },
  {
    name: 'Chart pie',
    content: `chart
style rough
kind pie
title Revenue Mix
legend right
categories Product, Services, Support, Training
series Mix: 40, 30, 20, 10`,
  },
  {
    name: 'Chart combo',
    content: `chart
style blueprint
kind combo
title Revenue vs Conversion
xlabel Month
ylabel Revenue
legend top
grid both
labels auto
y2ticks 4
categories Jan, Feb, Mar, Apr
ref y 20 label=Target color=#ef4444
annotate Mar,24:Peak color=#0f172a
series Revenue [type=bar color=#2563eb]: 12, 18, 24, 28
series Conversion [type=line axis=right color=#16a34a curve=smooth labels=show]: 2.1, 2.8, 3.4, 3.9`,
  },
  {
    name: 'Chart heatmap',
    content: `chart
style clean
kind heatmap
title Reliability Matrix
cell API,Mon: 91
cell API,Tue: 88
cell API,Wed: 93
cell Web,Mon: 94
cell Web,Tue: 90
cell Web,Wed: 96
cell Jobs,Mon: 86
cell Jobs,Tue: 84
cell Jobs,Wed: 89`,
  },
  {
    name: 'Chart sankey',
    content: `chart
style architect
kind sankey
title Pipeline Flow
flow leads -> demo: 48
flow leads -> nurture: 26
flow demo -> won: 18
flow demo -> lost: 14
flow nurture -> demo: 10
flow nurture -> lost: 8`,
  },
  {
    name: 'Chart gauge',
    content: `chart
style clean
kind gauge
title SLA Health
ymin 0
ymax 100
threshold 60 #16a34a Good
threshold 85 #f59e0b Watch
threshold 100 #dc2626 Critical
series Health: 72`,
  },
]
