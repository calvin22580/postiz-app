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

const rebrand = (source, file, name) => {
  if (!name || isExcluded(file) || source.indexOf('Postiz') === -1) {
    return source;
  }
  return source.replace(NAME_PATTERN, name);
};

module.exports = function rebrandLoader(source) {
  const options = (this.getOptions && this.getOptions()) || {};
  return rebrand(source, this.resourcePath, options.name);
};

module.exports.rebrand = rebrand;
module.exports.NAME_PATTERN = NAME_PATTERN;
