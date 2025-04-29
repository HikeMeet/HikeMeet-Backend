import { User } from '../models/User';

//////////////////////////////////////////////////need to add nptifaiction if the user "level up"
// Rookie: (exp >= 0 && exp < 50)
// Adventurer: (exp >= 50 && exp < 120)
// Veteran: (exp >= 120 && exp < 220)
// Epic: (exp >= 220 && exp < 340)
// Elite: (exp >= 340 && exp < 480)
// Legend : (exp >480)

export async function updateUserExp(userId: string, amount: number) {
  try {
    await User.findByIdAndUpdate(userId, { $inc: { exp: amount } });
  } catch (error) {
    console.error('Failed to update EXP for user:', userId, error);
  }
}
