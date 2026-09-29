export interface TierInfo {
  tier: string
  minScore: number
  color: string
  badgeBg: string
}

export const TIERS: TierInfo[] = [
  { tier: 'Diamond', minScore: 5000, color: '#38B9F2', badgeBg: 'rgba(56, 185, 242, 0.2)' },
  { tier: 'Platinum II', minScore: 3500, color: '#a78bfa', badgeBg: 'rgba(167, 139, 250, 0.2)' },
  { tier: 'Platinum I', minScore: 2500, color: '#c084fc', badgeBg: 'rgba(192, 132, 252, 0.2)' },
  { tier: 'Gold', minScore: 1800, color: '#fbb01b', badgeBg: 'rgba(251, 176, 27, 0.2)' },
  { tier: 'Silver', minScore: 1300, color: '#94a3b8', badgeBg: 'rgba(148, 163, 184, 0.2)' },
  { tier: 'Bronze', minScore: 0, color: '#d97706', badgeBg: 'rgba(217, 119, 6, 0.2)' },
]

export interface UserTierProgress {
  currentTier: string
  currentTierColor: string
  currentTierBg: string
  nextTier: string | null
  pointsToNextTier: number
  progressPercent: number
}

export function getUserTier(score: number): UserTierProgress {
  const safeScore = Math.max(0, score)

  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i]
    if (safeScore >= t.minScore) {
      const next = i > 0 ? TIERS[i - 1] : null
      if (!next) {
        return {
          currentTier: t.tier,
          currentTierColor: t.color,
          currentTierBg: t.badgeBg,
          nextTier: null,
          pointsToNextTier: 0,
          progressPercent: 100,
        }
      }

      const tierRange = next.minScore - t.minScore
      const userProgress = safeScore - t.minScore
      const progressPercent = Math.min(100, Math.max(0, Math.floor((userProgress / tierRange) * 100)))

      return {
        currentTier: t.tier,
        currentTierColor: t.color,
        currentTierBg: t.badgeBg,
        nextTier: next.tier,
        pointsToNextTier: next.minScore - safeScore,
        progressPercent,
      }
    }
  }

  // Fallback to Bronze
  const bronze = TIERS[TIERS.length - 1]
  const silver = TIERS[TIERS.length - 2]
  return {
    currentTier: bronze.tier,
    currentTierColor: bronze.color,
    currentTierBg: bronze.badgeBg,
    nextTier: silver.tier,
    pointsToNextTier: silver.minScore - safeScore,
    progressPercent: 0,
  }
}

/**
 * Calculates remaining seconds before streak breaks (midnight UTC of the day following last bet day)
 */
export function getStreakSecondsLeft(lastBetDay: string | null): number {
  if (!lastBetDay) return 0
  const now = new Date()
  // Midnight UTC of today
  const endOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  const remainingSec = Math.max(0, Math.floor((endOfTodayUtc.getTime() - now.getTime()) / 1000))
  return remainingSec
}
