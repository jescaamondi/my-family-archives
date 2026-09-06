# Family Archive — final UI baseline

This version is the clean UI baseline for the redesign.

## Structure

Each feature owns its stylesheet:

- `components/AddMemory/AddMemory.jsx` + `AddMemory.css`
- `components/Auth.jsx` + `Auth.css`
- `components/FamilyMembers/FamilyMembers.jsx` + `FamilyMembers.css`
- `components/FamilyTree/FamilyTree.jsx` + `FamilyTree.css`
- `components/Gallery/Gallery.jsx` + `Gallery.css`
- `components/Home/Home.jsx` + `Home.css`
- `components/Lightbox/Lightbox.jsx` + `Lightbox.css`
- `components/Milestones/Milestones.jsx` + `Milestones.css`
- `components/Stories/Stories.jsx` + `Stories.css`
- `components/Timeline/Timeline.jsx` + `Timeline.css`

Global layout tokens live in `src/styles/` and `App.css` only imports them.

## Important fixes included

- Gallery category filter typo fixed.
- Timeline component syntax/structure cleaned up.
- Stories now imports its own CSS.
- Family Tree now receives approved family members from `App.jsx`.
- Lightbox supports image and video memories.
- Mobile navigation becomes a horizontal navigation bar.
- Add Memory keeps the existing Supabase upload/insert behavior.
- Family Members keeps the existing approval/admin behavior.

## Gallery v15
- Drag-and-drop uploads are supported in the Gallery upload dialog.
- Family-created albums can optionally have a custom photo cover.
- Direct uploads still appear in All memories even when no album is selected.
- Apply `supabase/migrations/005_gallery_album_covers.sql` after the previous migrations.
\n## Story audio memories\nStories now support an optional private audio memory. Run `supabase/migrations/006_story_audio_memories.sql`, then stories can upload and play voice recordings from the existing `family-media` bucket.\n
## Scheduled milestone push reminders

v24 adds Web Push delivery for milestone reminders, so reminders can arrive even when Family Archive is closed. See `supabase/functions/send-milestone-reminders/README.md` and migration `010_milestone_scheduled_push_reminders.sql`.

Set the frontend `VITE_VAPID_PUBLIC_KEY` to the public VAPID key, deploy the Edge Function with the matching private key, and configure the Supabase cron job described in the function README.
