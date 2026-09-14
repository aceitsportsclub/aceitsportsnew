import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

try {
  process.loadEnvFile('.env.local');
} catch {
  // ignore if already in environment
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  const { data: userList, error: listErr } = await sb.auth.admin.listUsers();
  if (listErr) {
    console.error('Error fetching users:', listErr.message);
    process.exit(1);
  }

  const owner = (userList?.users || []).find(
    (u) =>
      (u.email && u.email.toLowerCase() === 'aceitsportsclub@gmail.com') ||
      (u.user_metadata?.username && u.user_metadata.username.toLowerCase() === 'founder') ||
      u.id === '781c5aa1-f6d5-4e89-abb7-682049486f92'
  );

  if (!owner) {
    console.error('Could not find existing OWNER account (aceitsportsclub@gmail.com / founder).');
    process.exit(1);
  }

  let newPassword = process.env.OWNER_PASSWORD || process.env.NEW_OWNER_PASSWORD;

  if (!newPassword) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    newPassword = await new Promise((resolve) => {
      rl.question('Enter new password for OWNER (founder / aceitsportsclub@gmail.com): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!newPassword || newPassword.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  const { error: updateErr } = await sb.auth.admin.updateUserById(owner.id, {
    password: newPassword,
    email_confirm: true
  });

  if (updateErr) {
    console.error('Error updating password:', updateErr.message);
    process.exit(1);
  }

  console.log('\n✅ [SUCCESS] Password updated successfully for OWNER (aceitsportsclub@gmail.com / founder).');
  console.log('You can now log in at http://localhost:3000 using either:');
  console.log('  - Username: founder');
  console.log('  - Email: aceitsportsclub@gmail.com\n');
}

main();
