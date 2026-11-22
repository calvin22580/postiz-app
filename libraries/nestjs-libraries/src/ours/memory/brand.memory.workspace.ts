// OURS: content engine E4. The Memory keeper's /memories folder for one
// organisation, held in memory for one keeper run. Every change the keeper
// asks for is checked here before it is accepted; a refused change is kept
// out, logged, and handed back to the keeper as an error that says why (the
// memory tool's documented error format). Nothing is stored until the run
// ends and our code saves the accepted changes in one go, so a failed run
// leaves memory as it was.
import type { MemoryToolHandlers } from '@anthropic-ai/sdk/helpers/beta/memory';
import {
  formatLessonFile,
  Lesson,
  LessonFileError,
  lessonProblems,
  MAX_EVIDENCE,
  MAX_LESSONS,
  MEMORY_FOLDERS,
  MEMORY_ROOT,
  MemoryFolder,
  parseLessonFile,
  parseMemoryPath,
  similarLessons,
} from '@gitroom/nestjs-libraries/ours/memory/brand.memory';

// A lesson the owner switched off or deleted: hidden from the keeper, and the
// keeper may not write it again.
export interface SwitchedOffLesson {
  path: string;
  lesson: string;
}

export interface MemoryRefusal {
  command: string;
  path: string;
  reason: string;
}

// A refused change. Thrown inside a memory tool handler, the SDK's tool
// runner returns it to the model as an error result.
export class MemoryRefusedError extends Error {}

export class MemoryWorkspace {
  private _lessons = new Map<string, Lesson>();
  // paths the keeper changed, created or removed in this run
  private _touched = new Set<string>();
  readonly refusals: MemoryRefusal[] = [];

  constructor(
    lessons: Lesson[],
    private _switchedOff: SwitchedOffLesson[],
    // the signal ids (first 8 characters) of this organisation a lesson may cite
    private _knownSignals: Set<string>
  ) {
    for (const l of lessons) this._lessons.set(l.path, { ...l });
  }

  lessons() {
    return [...this._lessons.values()];
  }

  // shown to the keeper, so it doesn't learn them again in other words
  switchedOff() {
    return [...this._switchedOff];
  }

  // The lessons this run changed (to save) and the paths it removed.
  changes() {
    const saved: Lesson[] = [];
    const removed: string[] = [];
    for (const path of this._touched) {
      const l = this._lessons.get(path);
      if (l) saved.push(l);
      else removed.push(path);
    }
    return { saved, removed };
  }

  // ---- the memory tool's commands ----

  view(path: string, range?: number[]) {
    const where = parseMemoryPath(path);
    if (!where) return this.refuse('view', path, `The path ${path} does not exist. Please provide a valid path.`);
    if (where.kind === 'file') {
      const l = this._lessons.get(path);
      if (!l) return this.refuse('view', path, `The path ${path} does not exist. Please provide a valid path.`);
      let lines = formatLessonFile(l).split('\n').map((line, i) => ({ n: i + 1, line }));
      if (range?.length === 2) {
        const [from, to] = range;
        lines = lines.filter(({ n }) => n >= from && (to === -1 || n <= to));
      }
      return `Here's the content of ${path} with line numbers:\n${lines.map(({ n, line }) => `${String(n).padStart(6)}\t${line}`).join('\n')}`;
    }
    const folders = where.kind === 'root' ? MEMORY_FOLDERS.map((f) => f.key) : [where.folder];
    const rows: string[] = [`${size(this.lessons().map(formatLessonFile).join('\n'))}\t${path}`];
    for (const folder of folders) {
      const inFolder = this.lessons().filter((l) => l.path.startsWith(`${MEMORY_ROOT}/${folder}/`));
      if (where.kind === 'root') rows.push(`${size(inFolder.map(formatLessonFile).join('\n'))}\t${MEMORY_ROOT}/${folder}`);
      for (const l of inFolder.sort((a, b) => a.path.localeCompare(b.path))) {
        rows.push(`${size(formatLessonFile(l))}\t${l.path}`);
      }
    }
    return `Here're the files and directories up to 2 levels deep in ${path}, excluding hidden items and node_modules:\n${rows.join('\n')}`;
  }

  create(path: string, text: string) {
    this.write('create', path, text);
    return `File created successfully at: ${path}`;
  }

  strReplace(path: string, oldStr: string, newStr = '') {
    const current = this.editable('str_replace', path);
    const file = formatLessonFile(current);
    const at = file.split(oldStr).length - 1;
    if (!oldStr || at === 0) {
      return this.refuse('str_replace', path, `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${path}.`);
    }
    if (at > 1) {
      return this.refuse('str_replace', path, `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\`. Please ensure it is unique`);
    }
    this.write('str_replace', path, file.replace(oldStr, newStr), current);
    return `The memory file has been edited.\n${this.view(path).split('\n').slice(1).join('\n')}`;
  }

  insert(path: string, line: number, text: string) {
    const current = this.editable('insert', path);
    const lines = formatLessonFile(current).split('\n');
    if (!Number.isInteger(line) || line < 0 || line > lines.length) {
      return this.refuse('insert', path, `Invalid \`insert_line\` parameter: ${line}. It should be within the range of lines of the file: [0, ${lines.length}]`);
    }
    lines.splice(line, 0, String(text ?? '').replace(/\n$/, ''));
    this.write('insert', path, lines.join('\n'), current);
    return `The file ${path} has been edited.`;
  }

  delete(path: string) {
    const where = parseMemoryPath(path);
    if (where?.kind !== 'file') {
      return this.refuse('delete', path, 'Only a single lesson file can be deleted, not a folder or the memory root.');
    }
    this.editable('delete', path);
    this._lessons.delete(path);
    this._touched.add(path);
    return `Successfully deleted ${path}`;
  }

  rename(oldPath: string, newPath: string) {
    const current = this.editable('rename', oldPath);
    if (parseMemoryPath(newPath)?.kind !== 'file') {
      return this.refuse('rename', newPath, `The destination ${newPath} is not a lesson file path. Use /memories/<folder>/<name>.md with one of the folders: ${MEMORY_FOLDERS.map((f) => f.key).join(', ')}.`);
    }
    if (this._lessons.has(newPath)) {
      return this.refuse('rename', newPath, `The destination ${newPath} already exists`);
    }
    this.checkLesson('rename', newPath, current);
    this._lessons.delete(oldPath);
    this._lessons.set(newPath, { ...current, path: newPath });
    this._touched.add(oldPath);
    this._touched.add(newPath);
    return `Successfully renamed ${oldPath} to ${newPath}`;
  }

  // ---- checks ----

  private editable(command: string, path: string) {
    const where = parseMemoryPath(path);
    const l = where?.kind === 'file' ? this._lessons.get(path) : undefined;
    if (!l) return this.refuse(command, path, `The path ${path} does not exist. Please provide a valid path.`);
    if (l.source === 'owner') {
      return this.refuse(command, path, 'The owner wrote or edited this lesson themselves, so it can only be read. Leave it as it is.');
    }
    return l;
  }

  private write(command: string, path: string, text: string, current?: Lesson) {
    const where = parseMemoryPath(path);
    if (where?.kind !== 'file') {
      return this.refuse(command, path, `Lessons go in /memories/<folder>/<name>.md, where the folder is one of: ${MEMORY_FOLDERS.map((f) => `${f.key} (${f.label.toLowerCase()})`).join(', ')}, and the name uses lower-case letters, digits and hyphens.`);
    }
    const existing = current || this._lessons.get(path);
    if (existing?.source === 'owner') {
      return this.refuse(command, path, 'The owner wrote or edited this lesson themselves, so it can only be read. Leave it as it is.');
    }
    let parsed;
    try {
      parsed = parseLessonFile(text);
    } catch (e) {
      if (e instanceof LessonFileError) return this.refuse(command, path, e.message);
      throw e;
    }
    const lesson: Lesson = { path, ...parsed, source: 'keeper' };
    this.checkLesson(command, path, lesson, !existing);
    this._lessons.set(path, lesson);
    this._touched.add(path);
  }

  private checkLesson(command: string, path: string, lesson: Lesson, isNew = false) {
    const folder = path.split('/')[2] as MemoryFolder;
    const problems = lessonProblems(lesson.lesson, folder);
    if (problems.length) {
      return this.refuse(
        command,
        path,
        `This lesson can't be stored because ${problems.join('; ')}. Brand memory holds only how the owner likes posts written and chosen; facts about the business come only from its profile.`
      );
    }
    if (!lesson.evidence.length) {
      return this.refuse(command, path, 'Every lesson needs evidence: the ids of the owner actions that taught it.');
    }
    if (lesson.evidence.length > MAX_EVIDENCE || lesson.against.length > MAX_EVIDENCE) {
      return this.refuse(command, path, `A lesson can cite at most ${MAX_EVIDENCE} owner actions each for and against.`);
    }
    const unknown = [...lesson.evidence, ...lesson.against].filter((r) => !this._knownSignals.has(r));
    if (unknown.length) {
      return this.refuse(command, path, `These are not ids of this owner's actions: ${unknown.join(', ')}. Cite only the ids given to you.`);
    }
    const off = this._switchedOff.find((o) => o.path === path || similarLessons(o.lesson, lesson.lesson));
    if (off) {
      return this.refuse(command, path, 'The owner switched off a lesson like this one. Don\'t write it again.');
    }
    if (isNew && this._lessons.size >= MAX_LESSONS) {
      return this.refuse(command, path, `Memory already holds ${MAX_LESSONS} lessons. Merge or delete weaker ones before adding another.`);
    }
  }

  private refuse(command: string, path: string, reason: string): never {
    this.refusals.push({ command, path, reason });
    throw new MemoryRefusedError(reason);
  }
}

const size = (s: string) => {
  const bytes = Buffer.byteLength(s, 'utf8');
  return bytes < 1024 ? `${bytes}` : `${(bytes / 1024).toFixed(1)}K`;
};

// The memory tool's six commands, run against the workspace.
export const memoryToolHandlers = (ws: MemoryWorkspace): MemoryToolHandlers => ({
  view: (c) => ws.view(c.path, c.view_range),
  create: (c) => ws.create(c.path, c.file_text),
  str_replace: (c) => ws.strReplace(c.path, c.old_str, c.new_str),
  insert: (c) => ws.insert(c.path, c.insert_line, c.insert_text),
  delete: (c) => ws.delete(c.path),
  rename: (c) => ws.rename(c.old_path, c.new_path),
});
