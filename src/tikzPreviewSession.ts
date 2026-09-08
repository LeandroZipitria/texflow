import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { createHash, randomUUID } from 'crypto';

const PREVIEW_ROOT_NAME = 'texflow-tikz-preview';
const SESSION_MARKER = '.texflow-session.json';
const SESSION_GRACE_MS = 6 * 60 * 60 * 1000;
const LEGACY_GRACE_MS = 24 * 60 * 60 * 1000;

interface SessionMarker {
  owner: 'texflow-tikz-preview';
  pid: number;
  createdAt: number;
}

function previewRoot(): string {
  return path.join(os.tmpdir(), PREVIEW_ROOT_NAME);
}

function isProcessRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code === 'EPERM';
  }
}

async function directoryAgeMs(dir: string, now: number): Promise<number> {
  try {
    const stat = await fs.stat(dir);
    return Math.max(0, now - stat.mtimeMs);
  } catch {
    return 0;
  }
}

async function readSessionMarker(dir: string): Promise<SessionMarker | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, SESSION_MARKER), 'utf8');
    const parsed = JSON.parse(raw) as Partial<SessionMarker>;
    if (parsed.owner !== 'texflow-tikz-preview') return undefined;
    if (!Number.isInteger(parsed.pid) || Number(parsed.pid) <= 0) return undefined;
    if (!Number.isFinite(parsed.createdAt) || Number(parsed.createdAt) <= 0) return undefined;
    return {
      owner: 'texflow-tikz-preview',
      pid: Number(parsed.pid),
      createdAt: Number(parsed.createdAt)
    };
  } catch {
    return undefined;
  }
}

async function removeDirectory(dir: string): Promise<boolean> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove only TeXFlow-owned preview directories that are old enough to be
 * abandoned. Active sessions from another VS Code extension host are kept.
 * Legacy Build C digest directories are cleaned only after a longer grace.
 */
export async function cleanupAbandonedTikzPreviewSessions(output?: vscode.OutputChannel): Promise<void> {
  const root = previewRoot();
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code !== 'ENOENT') output?.appendLine(`[warning] TikZ temporary cleanup skipped: ${String(error)}`);
    return;
  }

  const now = Date.now();
  let removed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);

    if (/^session-\d+-\d+-[0-9a-f-]+$/i.test(entry.name)) {
      const marker = await readSessionMarker(dir);
      if (marker) {
        const age = Math.max(0, now - marker.createdAt);
        if (marker.pid === process.pid || isProcessRunning(marker.pid) || age < SESSION_GRACE_MS) continue;
        if (tabReferencesDirectory(dir)) continue;
        if (await removeDirectory(dir)) removed++;
        continue;
      }

      // A crash can occur between mkdir and writing the marker. Treat an
      // unmarked session directory like a legacy directory and clean it only
      // after the longer grace period.
      if (await directoryAgeMs(dir, now) >= LEGACY_GRACE_MS && !tabReferencesDirectory(dir) && await removeDirectory(dir)) removed++;
      continue;
    }

    // Build C used one 16-hex digest directory per preview. Restrict cleanup to
    // that exact historical naming scheme so unrelated temporary content is
    // never touched.
    if (/^[0-9a-f]{16}$/i.test(entry.name)) {
      if (await directoryAgeMs(dir, now) >= LEGACY_GRACE_MS && !tabReferencesDirectory(dir) && await removeDirectory(dir)) removed++;
    }
  }

  if (removed > 0) output?.appendLine(`[info] Removed ${removed} abandoned TeXFlow TikZ temporary director${removed === 1 ? 'y' : 'ies'}.`);
}

function openTabUris(): vscode.Uri[] {
  const uris: vscode.Uri[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input as unknown as {
        uri?: vscode.Uri;
        original?: vscode.Uri;
        modified?: vscode.Uri;
      };
      if (input?.uri) uris.push(input.uri);
      if (input?.original) uris.push(input.original);
      if (input?.modified) uris.push(input.modified);
    }
  }
  return uris;
}

function tabReferencesUri(uri: vscode.Uri): boolean {
  const target = uri.toString();
  return openTabUris().some(candidate => candidate.toString() === target);
}

function tabReferencesDirectory(dir: string): boolean {
  const base = path.resolve(dir);
  return openTabUris().some(candidate => {
    if (!candidate.fsPath) return false;
    const target = path.resolve(candidate.fsPath);
    const relative = path.relative(base, target);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  });
}

export class TikzPreviewSession {
  private readonly createdAt = Date.now();
  private readonly sessionDir = path.join(
    previewRoot(),
    `session-${process.pid}-${this.createdAt}-${randomUUID()}`
  );
  private readonly generatedPdfs = new Set<string>();
  private initialized = false;
  private disposeRequested = false;
  private activeOperations = 0;
  private tabListener: vscode.Disposable | undefined;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.sessionDir, { recursive: true });
    const marker: SessionMarker = {
      owner: 'texflow-tikz-preview',
      pid: process.pid,
      createdAt: this.createdAt
    };
    await fs.writeFile(path.join(this.sessionDir, SESSION_MARKER), JSON.stringify(marker), 'utf8');
    this.initialized = true;
  }

  async buildDirectory(masterDocument: vscode.TextDocument, tikzRaw: string): Promise<string> {
    await this.ensureInitialized();
    const digest = createHash('sha256')
      .update(masterDocument.uri.toString())
      .update('\0')
      .update(tikzRaw)
      .digest('hex')
      .slice(0, 16);
    const dir = path.join(this.sessionDir, digest);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  trackPdf(uri: vscode.Uri): void {
    this.generatedPdfs.add(uri.toString());
  }

  beginOperation(): { end: () => Promise<void> } {
    this.activeOperations++;
    let ended = false;
    return {
      end: async () => {
        if (ended) return;
        ended = true;
        this.activeOperations = Math.max(0, this.activeOperations - 1);
        if (this.disposeRequested) await this.tryCleanup();
      }
    };
  }

  async disposeWhenSafe(): Promise<void> {
    this.disposeRequested = true;
    await this.tryCleanup();
  }

  private hasOpenPreviewPdf(): boolean {
    for (const value of this.generatedPdfs) {
      try {
        if (tabReferencesUri(vscode.Uri.parse(value))) return true;
      } catch {
        // Ignore a malformed transient URI and continue checking the others.
      }
    }
    return false;
  }

  private ensureTabListener(): void {
    if (this.tabListener) return;
    this.tabListener = vscode.window.tabGroups.onDidChangeTabs(() => {
      void this.tryCleanup();
    });
  }

  private clearTabListener(): void {
    this.tabListener?.dispose();
    this.tabListener = undefined;
  }

  private async tryCleanup(): Promise<void> {
    if (!this.disposeRequested || this.activeOperations > 0) return;
    if (!this.initialized) {
      this.clearTabListener();
      return;
    }
    if (this.hasOpenPreviewPdf()) {
      this.ensureTabListener();
      return;
    }

    this.clearTabListener();
    try {
      await fs.rm(this.sessionDir, { recursive: true, force: true });
      this.initialized = false;
      this.generatedPdfs.clear();
    } catch {
      // Startup cleanup will retry abandoned TeXFlow-owned directories later.
    }
  }
}
