#!/usr/bin/env tsx
/**
 * CLI script to create or promote an admin user.
 * 
 * Usage (run inside backend container):
 *   docker compose exec backend npx tsx src/scripts/createAdmin.ts create admin@example.com SecurePass123! Admin User
 *   docker compose exec backend npx tsx src/scripts/createAdmin.ts promote existing@user.com
 *   docker compose exec backend npx tsx src/scripts/createAdmin.ts demote admin@user.com
 *   docker compose exec backend npx tsx src/scripts/createAdmin.ts list
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? 'mongodb://localhost:27017/nexus';

async function main() {
  const [,, cmd, ...args] = process.argv;

  if (!cmd || !['create', 'promote', 'demote', 'list'].includes(cmd)) {
    console.error('Usage: createAdmin.ts <create|promote|demote|list> [args]');
    console.error('  create  <email> <password> <firstName> <lastName>');
    console.error('  promote <email>');
    console.error('  demote  <email>');
    console.error('  list');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Lazy import after mongoose connect
  const User = (await import('../models/User')).default;

  switch (cmd) {
    case 'create': {
      const [email, password, firstName, lastName] = args;
      if (!email || !password || !firstName || !lastName) {
        console.error('Usage: create <email> <password> <firstName> <lastName>');
        process.exit(1);
      }
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        console.error(`❌ User ${email} already exists. Use 'promote' to change role.`);
        process.exit(1);
      }
      const user = new User({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        role: 'admin',
        accountType: 'candidate',
        isVerified: true,
        twoFactorEnabled: false,
      });
      await user.save();
      console.log(`✅ Admin user created: ${firstName} ${lastName} <${email}>`);
      break;
    }

    case 'promote': {
      const [email] = args;
      if (!email) { console.error('Usage: promote <email>'); process.exit(1); }
      const user = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: { role: 'admin' } },
        { new: true }
      );
      if (!user) { console.error(`❌ User ${email} not found`); process.exit(1); }
      console.log(`✅ Promoted ${user.firstName} ${user.lastName} <${email}> to admin`);
      break;
    }

    case 'demote': {
      const [email] = args;
      if (!email) { console.error('Usage: demote <email>'); process.exit(1); }
      const user = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: { role: 'user' } },
        { new: true }
      );
      if (!user) { console.error(`❌ User ${email} not found`); process.exit(1); }
      console.log(`✅ Demoted ${user.firstName} ${user.lastName} <${email}> to regular user`);
      break;
    }

    case 'list': {
      const admins = await User.find({ role: 'admin' }).select('firstName lastName email createdAt').lean();
      if (admins.length === 0) { console.log('No admin users found.'); break; }
      console.log(`\n📋 Admin users (${admins.length}):`);
      admins.forEach(a => console.log(`  • ${a.firstName} ${a.lastName} <${a.email}> — created ${a.createdAt.toLocaleDateString()}`));
      break;
    }
  }

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
