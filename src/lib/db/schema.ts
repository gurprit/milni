import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const memberRole = pgEnum('member_role', ['owner', 'organiser', 'family_admin', 'guest', 'vendor']);
export const eventVisibility = pgEnum('event_visibility', ['all_guests', 'invited_only', 'organisers_only']);

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const weddings = pgTable('weddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  partnerOneName: text('partner_one_name').notNull(),
  partnerTwoName: text('partner_two_name').notNull(),
  city: text('city'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  heroImageUrl: text('hero_image_url'),
  singlesEnabled: boolean('singles_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const weddingMembers = pgTable('wedding_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'cascade' }).notNull(),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  role: memberRole('role').default('guest').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

export const traditionTemplates = pgTable('tradition_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  summary: text('summary').notNull(),
  suggestedDurationMinutes: integer('suggested_duration_minutes'),
  cultureTags: text('culture_tags').array(),
});

export const weddingTraditions = pgTable('wedding_traditions', {
  id: uuid('id').defaultRandom().primaryKey(),
  weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'cascade' }).notNull(),
  templateId: uuid('template_id').references(() => traditionTemplates.id),
  customName: text('custom_name'),
  customExplanation: text('custom_explanation'),
});

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'cascade' }).notNull(),
  traditionId: uuid('tradition_id').references(() => weddingTraditions.id),
  name: text('name').notNull(),
  description: text('description'),
  dressCode: text('dress_code'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  visibility: eventVisibility('visibility').default('all_guests').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'cascade' }).notNull(),
  code: text('code').notNull().unique(),
  token: text('token').notNull().unique(),
  guestName: text('guest_name'),
  maxUses: integer('max_uses').default(1).notNull(),
  useCount: integer('use_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'cascade' }).notNull(),
  authorProfileId: uuid('author_profile_id').references(() => profiles.id),
  title: text('title'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
