import { promises as fs } from "fs";
import path from "path";

const statePath = process.env.QUANT_LEARNING_STATE_PATH
  ? path.resolve(process.env.QUANT_LEARNING_STATE_PATH)
  : path.resolve(process.cwd(), "data", "learning-state.json");

async function ensureDir() {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
}

export async function loadLearningState(): Promise<any | null> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveLearningState(state: any): Promise<void> {
  try {
    await ensureDir();
    const tmpPath = `${statePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmpPath, statePath);
  } catch {
    // Best-effort only
  }
}

export function getLearningStatePath(): string {
  return statePath;
}
