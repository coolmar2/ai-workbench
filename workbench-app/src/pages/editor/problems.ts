import { sampleProblemList } from './sampleFs'

/** Problem counts for the panel badge and the status bar. Only the sample Orbit workspace has any. */
export function problemCount(sample: boolean, root: string) {
  if (!sample || root !== 'sample:Orbit') return { errors: 0, warnings: 0, total: 0 }
  const errors = sampleProblemList.filter((p) => p.sev === 'e').length
  const warnings = sampleProblemList.filter((p) => p.sev === 'w').length
  return { errors, warnings, total: sampleProblemList.length }
}
