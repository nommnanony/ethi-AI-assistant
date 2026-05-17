import { PrismaClient, UserRole, SubscriptionTier, SubscriptionStatus, AIProvider, AIModel } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Admin user
  const adminPassword = hashSync('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@natively.ai' },
    update: {},
    create: {
      email: 'admin@natively.ai',
      name: 'Admin User',
      passwordHash: adminPassword,
      emailVerified: true,
      role: UserRole.SUPER_ADMIN,
      subscription: {
        create: {
          tier: SubscriptionTier.ENTERPRISE,
          status: SubscriptionStatus.ACTIVE,
          aiCredits: 100000,
        },
      },
    },
  });
  console.log(`  ✓ Admin user created: ${admin.email}`);

  // 2. Feature flags
  const flags = [
    { name: 'voice_transcription', enabled: true },
    { name: 'ai_chat_history', enabled: true },
    { name: 'workspace_collaboration', enabled: false },
    { name: 'custom_ai_providers', enabled: true },
    { name: 'bulk_export', enabled: false },
    { name: 'sso_login', enabled: false },
    { name: 'audit_logging', enabled: true },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: { enabled: flag.enabled },
      create: flag,
    });
  }
  console.log(`  ✓ ${flags.length} feature flags created`);

  // 3. Subscription tiers / coupons
  const coupons = [
    { code: 'LAUNCH2024', discountPercent: 50, maxRedemptions: 1000, description: 'Launch discount - 50% off' },
    { code: 'TEAM20', discountPercent: 20, maxRedemptions: 500, description: 'Team plan - 20% off' },
    { code: 'EARLYBIRD', discountAmount: 2000, maxRedemptions: 200, description: 'Early bird - $20 off' },
  ];

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  }
  console.log(`  ✓ ${coupons.length} coupons created`);

  // 4. Example prompts and templates
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'personal-admin' },
    update: {},
    create: {
      name: 'Personal',
      slug: 'personal-admin',
      ownerId: admin.id,
      isPersonal: true,
      members: {
        create: {
          userId: admin.id,
          role: 'OWNER' as const,
        },
      },
    },
  });

  const prompts = [
    { name: 'Code Review Assistant', content: 'Review the following code for bugs, security issues, and best practices:\n\n```\n{{code}}\n```\n\nProvide a detailed analysis.', description: 'AI-powered code review', tags: ['code', 'review', 'best-practices'], isTemplate: true },
    { name: 'Meeting Notes Summarizer', content: 'Summarize the following meeting notes into key decisions, action items, and open questions:\n\n{{notes}}', description: 'Transform meeting notes into structured summaries', tags: ['meeting', 'summary', 'productivity'], isTemplate: true },
    { name: 'Technical Writer', content: 'Write technical documentation for the following feature:\n\n{{feature}}\n\nInclude an overview, usage examples, API reference, and common pitfalls.', description: 'Generate technical documentation', tags: ['docs', 'writing', 'technical'], isTemplate: true },
    { name: 'Brainstorming Partner', content: 'Let us brainstorm ideas around: {{topic}}\n\nGenerate at least 10 creative ideas, then help me evaluate the top 3.', description: 'Creative brainstorming assistant', tags: ['creative', 'brainstorming', 'ideas'], isTemplate: true },
  ];

  for (const prompt of prompts) {
    await prisma.prompt.create({
      data: {
        ...prompt,
        workspaceId: workspace.id,
        userId: admin.id,
        isPublic: true,
      },
    });
  }
  console.log(`  ✓ ${prompts.length} example prompts created`);

  // 5. Default AI provider config
  await prisma.userAIConfig.upsert({
    where: { id: 'default-admin-config' },
    update: {},
    create: {
      id: 'default-admin-config',
      userId: admin.id,
      provider: AIProvider.OPENAI,
      model: AIModel.GPT_4O,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      isDefault: true,
    },
  });
  console.log('  ✓ Default AI provider config created');

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
