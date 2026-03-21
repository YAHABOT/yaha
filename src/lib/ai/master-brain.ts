import fs from 'fs'
import path from 'path'

const BRAIN_DIR = 'c:/Users/the--/Documents/Projects/AI brain'

export async function getMasterBrainContext(): Promise<string> {
  const filesToRead = [
    { path: 'context/me.md', label: 'USER_PROFILE' },
    { path: 'context/work.md', label: 'USER_WORK' },
    { path: 'projects/YAHA/observations.md', label: 'DEV_OBSERVATIONS' },
  ]

  let context = '## MASTER BRAIN CONTEXT (Long-term Memory)\n\n'

  for (const file of filesToRead) {
    const fullPath = path.join(BRAIN_DIR, file.path)
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        context += `### ${file.label}\n${content}\n\n`
      }
    } catch (err) {
      console.error(`Failed to read brain file ${fullPath}:`, err)
    }
  }

  return context
}
