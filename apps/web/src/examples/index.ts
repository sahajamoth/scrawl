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
]
