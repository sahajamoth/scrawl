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
]
