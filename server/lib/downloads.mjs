// All-time download counter for installers served from /files/, persisted in DATA_DIR/downloads.json.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PLATFORMS } from './release.mjs';

export class DownloadStats {
  constructor({ dataDir, log = console }) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'downloads.json');
    this.log = log;
    this.counts = {};
    this.writing = Promise.resolve();
  }

  async load() {
    try {
      this.counts = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') this.log.error(`[downloads] ignoring unreadable downloads.json: ${err.message}`);
    }
  }

  /** Count one download of an installer file; names that match no platform are ignored. */
  add(fileName) {
    const platform = Object.keys(PLATFORMS).find((k) => PLATFORMS[k].test(fileName));
    if (!platform) return;
    this.counts[platform] = (this.counts[platform] ?? 0) + 1;
    // Downloads are rare, so every count is written right away; writes are serialized.
    const snapshot = JSON.stringify(this.counts);
    this.writing = this.writing.then(async () => {
      await mkdir(this.dataDir, { recursive: true });
      await writeFile(`${this.file}.tmp`, snapshot);
      await rename(`${this.file}.tmp`, this.file);
    }).catch((err) => this.log.error(`[downloads] ${err.message}`));
  }

  /** Per-platform totals: local downloads plus GitHub's own counts over every release. */
  totals(history) {
    const result = {};
    for (const key of Object.keys(PLATFORMS)) {
      result[key] = (this.counts[key] ?? 0) + history.reduce((sum, r) => sum + (r.downloads?.[key] ?? 0), 0);
    }
    return result;
  }
}
