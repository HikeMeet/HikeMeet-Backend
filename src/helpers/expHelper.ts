import mongoose from 'mongoose';
import { User } from '../models/User';
import { notifyUserLevelUp } from './notifications';

//////////////////////////////////////////////////need to add nptifaiction if the user "level up"
// Rookie: (exp >= 0 && exp < 50)
// Adventurer: (exp >= 50 && exp < 120)
// Veteran: (exp >= 120 && exp < 220)
// Epic: (exp >= 220 && exp < 340)
// Elite: (exp >= 340 && exp < 480)
// Legend : (exp >480)

export async function updateUserExp(userId: string, amount: number) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const previousExp = user.exp ?? 0;
    // clamp so it never drops below 0
    const rawExp = previousExp + amount;
    const newExp = rawExp < 0 ? 0 : rawExp;

    const previousRank = getRankByExp(previousExp);
    const newRank = getRankByExp(newExp);

    await User.findByIdAndUpdate(userId, {
      exp: newExp,
      rank: newRank,
    });

    if (previousRank !== newRank) {
      await notifyUserLevelUp(new mongoose.Types.ObjectId(userId), previousRank, newRank);
    }
  } catch (error) {
    console.error('Failed to update EXP for user:', userId, error);
  }
}
export function getRankByExp(exp: number): string {
  if (exp >= 0 && exp < 50) return 'Rookie';
  if (exp >= 50 && exp < 120) return 'Adventurer';
  if (exp >= 120 && exp < 220) return 'Veteran';
  if (exp >= 220 && exp < 340) return 'Epic';
  if (exp >= 340 && exp < 480) return 'Elite';
  return 'Legend';
}
