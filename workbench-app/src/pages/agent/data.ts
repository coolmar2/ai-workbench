import type { Vendor } from '../../data/types'

/** One row of the Accounts section in the right rail (built from the live accounts feed). */
export interface AgAccount { vendor: Vendor; name: string; how: string }
