# Family Tree v2 setup

Run `migrations/002_family_tree_v2.sql` in the Supabase SQL Editor after the existing `family_members` table is available.

This migration adds:

- `family_people` for actual family profiles (separate from login/access records)
- `family_relationships` for parent and spouse relationships
- private profile-photo storage under the existing `family-media` bucket
- RLS so approved family members can read and contribute

The React Family Tree then:

- loads people and relationships in real time
- generates generations from parent relationships
- supports search and zoom
- opens a detailed person drawer
- lets an approved family member add a person
- lets them upload a profile photo
- lets them connect a new person to a parent and/or partner

The app intentionally keeps `family_members` for authentication/approval/admin access. Do not use it as the source of truth for genealogy.

## Family Archive v3 migration

Run `migrations/003_family_memories_stories_milestones.sql` after the existing family archive migrations.

It adds:
- `memory_people` to connect gallery photos/videos to people in the family tree.
- `family_stories`, `story_people`, and `story_comments` for user-created stories and replies.
- `family_milestones`, `milestone_people`, `milestone_media`, `milestone_comments`, and `milestone_contributions` for shared future plans, inspiration and collaboration.

All new tables use the approved-family-member access boundary and the existing private `family-media` storage bucket.
