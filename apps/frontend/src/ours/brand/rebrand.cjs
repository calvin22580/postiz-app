// OURS: build-time rebrand of upstream's customer-facing text.
//
// Upstream hard-codes its product name in ~45 frontend files and 16 locale
// files. Editing each one would conflict on every upstream merge, so instead
// this loader swaps the name while the frontend is compiled. Upstream source
// stays untouched on disk. Wired up by ours/next/with-ours.mjs.
//
// Only the capitalised product name is replaced, as a whole word. Lower-case
// "postiz" (package names, domains, CLI commands, imports) is left alone.

const NAME_PATTERN = /(?<![@/.\w-])Postiz(?![\w-])/g;

// Files whose text must never be rebranded:
// - testimonials are quotes from real people about upstream; renaming them
//   would invent testimonials for us (FORK_RULES: never invent facts).
const EXCLUDE = [/[\\/]helpers[\\/]testomonials\.tsx$/];

const isExcluded = (file) => EXCLUDE.some((re) => re.test(file || ''));

// Upstream links that would send customers to upstream's own legal pages.
const LINK_DEFAULTS = {
  'https://postiz.com/terms': '/terms.html',
  'https://postiz.com/privacy': '/privacy.html',
};

const rebrand = (source, file, name, links = {}) => {
  if (isExcluded(file)) {
    return source;
  }
  let out = source;
  for (const [from, fallback] of Object.entries(LINK_DEFAULTS)) {
    if (out.indexOf(from) !== -1) {
      out = out.split(from).join(links[from] || fallback);
    }
  }
  if (name && out.indexOf('Postiz') !== -1) {
    out = out.replace(NAME_PATTERN, name);
  }
  return out;
};

module.exports = function rebrandLoader(source) {
  const options = (this.getOptions && this.getOptions()) || {};
  return rebrand(source, this.resourcePath, options.name, options.links);
};

module.exports.rebrand = rebrand;
module.exports.NAME_PATTERN = NAME_PATTERN;
