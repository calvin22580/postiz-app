// OURS: a small robots.txt reader. Follows the group for our user agent, or
// "*" when there is none, and picks the longest matching Allow/Disallow rule.

interface Rule {
  allow: boolean;
  path: string;
}

const toRegex = (path: string) =>
  new RegExp(
    '^' +
      path
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$')
  );

export const parseRobots = (body: string, userAgent: string) => {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of (body || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      // an empty Disallow means "allow everything"
      if (value) current.rules.push({ allow: field === 'allow', path: value });
    }
  }

  const ua = userAgent.toLowerCase();
  const mine = groups.filter((g) =>
    g.agents.some((a) => a !== '*' && ua.includes(a))
  );
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*')))
    .flatMap((g) => g.rules);

  return {
    isAllowed(pathWithQuery: string) {
      let best: Rule | null = null;
      for (const rule of rules) {
        if (!toRegex(rule.path).test(pathWithQuery)) continue;
        if (
          !best ||
          rule.path.length > best.path.length ||
          (rule.path.length === best.path.length && rule.allow)
        ) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
};

export type Robots = ReturnType<typeof parseRobots>;
