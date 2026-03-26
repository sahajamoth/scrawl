export interface Example {
  name: string
  content: string
}

export const EXAMPLES: Example[] = [
  {
    name: 'Simple flow',
    content: `[d]
title = "Simple Flow"
dir = "lr"

[[n]]
id = "a"
l = "Start"
s = "c"
c = "green"

[[n]]
id = "b"
l = "Process"
s = "r"

[[n]]
id = "c"
l = "End"
s = "c"
c = "red"

[[e]]
f = "a"
t = "b"

[[e]]
f = "b"
t = "c"`,
  },
  {
    name: 'Architecture',
    content: `[d]
title = "Web Architecture"
dir = "td"

[[n]]
id = "browser"
l = "Browser"
s = "r"
c = "blue"

[[n]]
id = "cdn"
l = "CDN"
s = "h"

[[n]]
id = "api"
l = "API Gateway"
s = "r"
c = "purple"

[[n]]
id = "db"
l = "Database"
s = "y"
c = "orange"

[[n]]
id = "cache"
l = "Redis Cache"
s = "y"
c = "red"

[[e]]
f = "browser"
t = "cdn"
l = "static"

[[e]]
f = "browser"
t = "api"
l = "REST"

[[e]]
f = "api"
t = "db"
l = "query"

[[e]]
f = "api"
t = "cache"
l = "lookup"
st = "dashed"

[[g]]
id = "backend"
l = "Backend"
nodes = ["api", "db", "cache"]`,
  },
  {
    name: 'Decision flow',
    content: `[d]
title = "Deploy Decision"
dir = "td"

[[n]]
id = "start"
l = "Push to main"
s = "r"

[[n]]
id = "tests"
l = "Tests pass?"
s = "d"

[[n]]
id = "deploy"
l = "Deploy to prod"
s = "r"
c = "green"

[[n]]
id = "notify"
l = "Notify team"
s = "r"
c = "red"

[[e]]
f = "start"
t = "tests"

[[e]]
f = "tests"
t = "deploy"
l = "yes"

[[e]]
f = "tests"
t = "notify"
l = "no"
st = "dashed"`,
  },
  {
    name: 'All shapes',
    content: `[d]
title = "Shape Reference"
dir = "lr"

[[n]]
id = "b"
l = "Box"
s = "b"

[[n]]
id = "r"
l = "Rounded"
s = "r"

[[n]]
id = "c"
l = "Circle"
s = "c"

[[n]]
id = "d"
l = "Diamond"
s = "d"

[[n]]
id = "y"
l = "Cylinder"
s = "y"

[[n]]
id = "p"
l = "Parallel"
s = "p"

[[n]]
id = "h"
l = "Hexagon"
s = "h"`,
  },
]
