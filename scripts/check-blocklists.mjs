// Checks our own endpoints against the main ad blocker lists, because a blocked endpoint fails
// silently in the visitor's browser. Only generic network rules count here, and this is a simple
// matcher, not a full filter engine, so treat a hit as something to read and not as proof.
//
//   npm run check-blocklists                      checks the endpoints the site uses
//   npm run check-blocklists -- /api/a /api/b     checks other paths, for choosing a new name
//
// Exits 1 when a rule matches. Worth running before launch and whenever an endpoint gets renamed.
const DEFAULT_PATHS = ['/api/activity', '/api/lead'];
const HOST = 'https://lawyerseoexpert.com';
const LISTS = [
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://easylist.to/easylist/easylist.txt',
  'https://ublockorigin.github.io/uAssets/filters/filters.txt',
  'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_3_Spyware/filter.txt',
  'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt',
];

function ruleToRegExp(pattern) {
  let body = pattern;
  let start = '';
  let end = '';
  if (body.startsWith('||')) {
    start = '^https?://([^/]*\\.)?';
    body = body.slice(2);
  } else if (body.startsWith('|')) {
    start = '^';
    body = body.slice(1);
  }
  if (body.endsWith('|')) {
    end = '$';
    body = body.slice(0, -1);
  }
  // A | left in the middle is a different syntax, which this simple matcher doesn't read.
  if (body.includes('|')) return null;
  const source = body
    .replace(/[.+?{}()[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\^/g, '([/?&=:]|$)');
  return new RegExp(start + source + end, 'i');
}

function networkRules(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^[!#[]/.test(line) &&
        !/#[@?$%]?#/.test(line) &&
        !line.startsWith('@@') &&
        !line.startsWith('/^') &&
        !/\$.*domain=/.test(line),
    );
}

const paths = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PATHS;
let matched = 0;
let unread = 0;

for (const list of LISTS) {
  const name = list.split('/').pop();
  const response = await fetch(list).catch(() => null);
  if (!response?.ok) {
    console.log(`${name}: could not be read`);
    unread += 1;
    continue;
  }
  const rules = networkRules(await response.text());
  const hits = [];
  for (const rule of rules) {
    const pattern = rule.split('$')[0];
    if (pattern.length < 4) continue;
    let regExp;
    try {
      regExp = ruleToRegExp(pattern);
    } catch {
      continue;
    }
    if (!regExp) continue;
    for (const path of paths) {
      if (regExp.test(HOST + path)) hits.push(`${path} is matched by ${rule}`);
    }
  }
  console.log(`${name}: ${rules.length} rules, ${hits.length} matches`);
  for (const hit of hits) console.log(`  ${hit}`);
  matched += hits.length;
}

if (unread) console.log(`${unread} of ${LISTS.length} lists could not be read, so this result is partial.`);
process.exit(matched ? 1 : 0);
