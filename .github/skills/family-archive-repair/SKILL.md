---
name: family-archive-repair
description: Repairs and QA-tests the Family Archive application end-to-end, including authentication, profiles, family members, Family Tree, Gallery, Stories, Milestones, Family Activity, notifications, media uploads, Supabase integration, responsive UI, and visual consistency.
---

# Family Archive Repair Skill

## Purpose

This skill is for repairing and quality-testing the Family Archive application.

Family Archive is a private family archive built with:

- React
- Vite
- Supabase

The application must feel like a premium, private family product rather than a public social network or generic SaaS dashboard.

---

# Core Rules

## 1. Private Family Archive

The application is private.

Always preserve:

- authentication
- family-member approval
- admin permissions
- Supabase Row Level Security
- private family media
- authorized access only

Never turn the application into a public social network.

Frontend visibility controls are not security controls.

Never weaken RLS simply to make a UI feature work.

---

## 2. Never Invent Database Schema

Before changing database-related code:

1. Inspect the repository.
2. Inspect Supabase migrations.
3. Search all existing `supabase.from(...)` calls.
4. Determine the canonical table names.
5. Determine the canonical columns.
6. Determine the existing relationships.
7. Check RLS policies.

Never invent a table or column when the existing schema can be determined.

If a feature genuinely requires a database change:

- create a proper migration
- use appropriate constraints
- add appropriate RLS
- avoid creating duplicate versions of an existing feature

Do not create competing schemas.

---

## 3. Real Data Only

The application must not use fake production data to make the interface look populated.

Never use:

- fake family members
- fake genealogy people
- fake family relationships
- fake dates
- fake activity
- fake statistics
- stock people as family members
- generated faces as family members
- mock photographs

Mock data may only exist in clearly isolated development/test code.

Never allow mock data to appear in the real Family Tree.

---

# Media and Storage Rules

## 4. Private Media

Family media should use the application's canonical private storage architecture.

Prefer:

```text
database
    ↓
storage path/reference
    ↓
signed URL
    ↓
displayed image

```

IMPORTANT:
- Do not give me a plan only.
- Do not just tell me what to change.
- Make the changes directly in the repository.
- Do the entire repair pass in this run.
- Do not stop after fixing one issue.
- Inspect existing code before modifying it.
- Inspect existing Supabase migrations before making database assumptions.
- Do not invent database tables or columns.
- If a database change is genuinely necessary, create a proper migration.
- Preserve RLS and the private-family security model.
- Never expose service-role keys, Supabase secret keys, VAPID private keys, cron secrets, or other privileged credentials in frontend code.
- Do not delete real user/family data.
- Do not replace real data with mock/demo data.
- Do not claim something is fixed unless you verify it.
- Run the build after all changes.
- Review the final git diff.
- Search the repository for old implementations that could cause the same bug elsewhere.

============================================================
FAMILY ARCHIVE REPAIR SKILL
============================================================

This is a PRIVATE FAMILY ARCHIVE.

The application uses:
- React
- Vite
- Supabase

Design direction:
- premium editorial family archive
- warm neutral palette
- strong readable contrast
- elegant serif headings
- clean sans-serif interface text
- restrained borders
- subtle shadows
- generous whitespace
- no unnecessary gradients
- no excessive pill-shaped UI
- no generic SaaS appearance
- no faded/washed-out colors

Functional principle:

REAL DATABASE DATA MUST DRIVE THE APPLICATION.

Never use fake people, fake photos, fake activity, fake statistics, or mock genealogy records to make the application appear populated.

For private media:
- use storage paths/references
- generate signed URLs when required
- never expose private credentials
- reuse the working Gallery upload architecture

For all create/edit/upload actions:
- loading state
- visible success state
- visible human-readable error state
- correct persistence
- verify after refresh

Always investigate the complete chain:

UI
→ React state
→ Supabase query
→ RLS
→ Storage
→ database
→ returned data
→ displayed UI

Do not fix symptoms while leaving the underlying failure.

============================================================
1. PASSWORD VISIBILITY EYE
============================================================

Fix BOTH login and signup password fields.

Currently passwords are masked, but the user needs an eye button/icon that allows them to temporarily see what they typed.

Implement this for:
- Login password
- Signup password
- Confirm password if the signup form has one

Requirements:

Default:
- password remains masked

When the eye is clicked:
- password becomes visible

When clicked again:
- password becomes masked

The control must:
- be accessible
- have an aria-label
- have a visible hover/focus state
- not submit the form
- use type="button"
- work on mobile and desktop
- have a sensible eye/eye-off icon

SECURITY:
- Never log the password.
- Never put the password into localStorage.
- Never put it into sessionStorage.
- Never put it into URL parameters.
- Never write it to analytics.
- Never expose it in console output.
- Never change how Supabase authentication sends the password.
- The eye only controls the HTML input visibility.

Inspect Auth.jsx and all authentication-related components.

============================================================
2. PROFILE — REMOVE PHOTO URL
============================================================

Remove the:

"Profile photo URL"

input completely.

The profile should NOT ask users to paste an image URL.

The profile workflow should instead have:

Display name

Profile photo

[Upload photo]

Short summary/about me

[Save profile]

Keep the upload button.

============================================================
3. PROFILE PHOTO UPLOAD
============================================================

Make sure the signed-in user can actually upload their own profile photo.

Flow:

Choose photo
→ preview
→ upload
→ save storage reference
→ signed URL if private
→ display
→ refresh
→ still visible

Allow replacing an existing photo.

Do not use a public URL field.

Do not expose private storage credentials.

Use the existing working Gallery storage/upload approach where appropriate.

============================================================
4. PROFILE SHORT SUMMARY
============================================================

Allow the signed-in user to write a short personal summary.

Requirements:
- textarea
- reasonable character limit
- save
- loading state
- success state
- error state
- display after saving
- survives page refresh

Use the existing canonical profile/family-member database record if possible.

Do not create a duplicate profile system.

If the canonical schema genuinely lacks a summary field, create the smallest appropriate migration.

============================================================
5. FAMILY MEMBERS PAGE — COMPLETE VISUAL REPAIR
============================================================

The current Family Members page looks unfinished and almost unstyled.

Redesign it to match the premium Family Archive design.

Keep all existing functionality.

Each member should have a polished presentation containing where appropriate:
- avatar/photo
- display name
- email
- approval status
- relevant role
- action buttons

Actions should be properly styled:
- Edit
- Approve
- Reject
- Make Admin
- Demote

Status filters should look like proper UI controls.

The page needs:
- strong heading
- supporting description
- clear status filter
- clean member list/cards
- proper spacing
- responsive layout
- accessible controls

Do not overuse rounded cards.

Do not use gradients.

Do not make it look like a generic admin dashboard.

============================================================
6. FAMILY MEMBER EDITING
============================================================

Existing family members must be editable.

Currently adding a member works but editing existing members does not.

Trace and fix:
- Edit button
- modal/form
- existing values loading
- update query
- RLS
- success handling
- error handling
- UI refresh

An authorized user must be able to edit an existing family member according to existing permissions.

Do NOT weaken RLS.

============================================================
7. FAMILY MEMBER PHOTO UPLOAD
============================================================

Family members must be able to have a photo uploaded directly.

Remove any photo URL requirement.

Use:

[Upload photo]

not:

[Photo URL]

Implement:
- file picker
- image validation
- preview
- upload
- loading
- error handling
- database/storage reference
- signed URL when required
- replacement of existing photo
- display after refresh

Reuse the Gallery media architecture.

============================================================
8. FAMILY TREE — START COMPLETELY FROM REAL DATA
============================================================

This is a major requirement.

REMOVE ALL MOCK/DEMO PEOPLE FROM THE FAMILY TREE.

The current tree contains people such as:
- Alexander
- Nina
- Michael
- Tamara
- Dmitry
- Anna
- Jessy

Determine which of these are hard-coded/demo data.

Remove hard-coded/mock genealogy records from the frontend.

Do NOT delete legitimate database records unless they are clearly seeded/demo records created by the application.

The Family Tree must be empty when there are no real genealogy records.

There must be NO stock/mock photos.

There must be NO invented dates.

There must be NO fake relationships.

============================================================
9. FAMILY TREE — PRESERVE THE STRUCTURE WE CHOSE
============================================================

Keep the overall layout concept that I like:

Generation 1
        ↓
Generation 2
        ↓
Generation 3
        ↓
youngest/current generation

The tree should form a clear generational architecture.

Use:
- horizontal relationship lines
- vertical connectors
- generation labels where useful
- clear spacing
- actual family relationships

Real people should automatically occupy the correct position based on their actual relationships.

A mock person must never occupy a position.

Adding a real family member should allow them to appear in the correct location.

============================================================
10. FAMILY TREE — EMPTY FRAMES BUT NO PHOTO PLACEHOLDERS
============================================================

I want the structural frames to remain visually clear, but I DO NOT want fake photo placeholders.

Important distinction:

ALLOWED:
- clean empty structural frame
- empty add-person position
- simple "+" or "Add person" affordance where appropriate

NOT ALLOWED:
- stock photo
- generated face
- fake avatar
- fake initials presented as a fake person
- fake name
- fake date
- fake relationship

When I add a real family member, the real person should populate that position.

The empty structure should not pretend that a person exists.

============================================================
11. FAMILY TREE — REMOVE BROWN ROOT GRAPHIC
============================================================

Remove the large brown decorative object currently behind the youngest/root person.

It should NOT be replaced by another decorative illustration.

The tree should communicate relationships using actual connector lines.

No giant brown root/tree shape.

============================================================
12. FAMILY TREE — REMOVE BACKGROUND ART/DECORATION
============================================================

Remove the unnecessary background illustration/interface decoration from the Family Tree.

The tree should have a clean background.

No:
- giant decorative root
- botanical illustration
- fake tree graphic
- faded decorative artwork
- visual clutter behind the people

The actual family structure must be the focus.

============================================================
13. FAMILY TREE — IMPROVE COLOR CONTRAST
============================================================

The current Family Tree feels faded.

Keep the warm editorial style but increase contrast.

Use:
- stronger dark text
- clearer borders
- more visible connector lines
- readable secondary text
- warm neutral surfaces
- restrained earthy accent

Do not turn the whole interface brown.

Do not use gradients.

The tree must look crisp and premium.

============================================================
14. FAMILY TREE — CLEAN CONTROLS
============================================================

Keep useful functionality:
- search
- zoom
- reset
- add person

But remove unnecessary decorative interface elements.

Controls should be visually secondary to the actual family tree.

============================================================
15. FAMILY TREE — CANONICAL DATABASE
============================================================

Inspect ALL existing migrations before changing this.

Determine the actual canonical family-tree schema.

Potential existing names include:

family_tree_members
family_tree_people
family_tree_relationships

There may be another canonical implementation.

Do not blindly use:

family_people
family_relationships

if those are not defined by the actual schema.

There must be ONE canonical Family Tree implementation.

Remove competing implementations from the frontend.

============================================================
16. GALLERY — MISSING 2018 PHOTO
============================================================

One of the 2018 photos is not appearing.

Find the underlying cause.

Audit:
- database query
- ordering
- date filtering
- pagination
- limits
- storage path
- signed URL
- image loading
- MIME type
- file extension
- CSS

Do NOT special-case 2018.

Fix the Gallery so all eligible images are reliably displayed.

Older photos must not disappear because of an arbitrary limit or date bug.

============================================================
17. PNG MEDIA DISPLAY
============================================================

PNG files are not appearing correctly in Family Activity and possibly other areas.

Fix the underlying media implementation.

Check:
- MIME type
- file extension
- storage
- signed URLs
- image URL construction
- transparent PNG visibility
- image dimensions
- loading errors
- CSS

Do not convert all PNGs unnecessarily.

PNG must be supported normally.

============================================================
18. FAMILY ACTIVITY
============================================================

There must be exactly ONE Family Activity navigation entry.

Remove the duplicate.

Also inspect the Family Activity implementation itself.

It must display real activity only.

Images must load correctly, including PNG.

Do not fabricate activity.

============================================================
19. NOTIFICATIONS
============================================================

The notification UI is currently cut off and cannot be properly seen.

Fix the entire notification presentation.

Inspect:
- bell
- dropdown/panel
- positioning
- z-index
- overflow
- parent containers
- sidebar
- viewport boundaries
- mobile behavior

The notification panel must be fully readable.

It must work on:
- desktop
- tablet
- mobile

The panel should never be clipped.

Also verify that notification data is actually displayed.

Do not simply make the text tiny.

============================================================
20. MILESTONES
============================================================

Milestone photo upload currently does not work.

Fix:
- create milestone
- cover/photo upload
- preview
- storage
- database reference
- signed URL
- display
- edit
- replace photo
- refresh persistence

Also re-check existing milestone functionality:
- title/name
- description
- owner
- start date
- target date
- progress
- budget
- currency
- inspiration media where supported
- comments
- replies
- contributions
- steps
- reminders

Use canonical existing schema.

Do not break the existing working:

send-milestone-reminders

Edge Function.

============================================================
21. STORIES
============================================================

Story publishing previously did not work.

Re-test and fix the entire flow:

- create story
- title
- text/content
- photo
- multiple photos where supported
- audio where supported
- family person association
- publish
- edit
- delete
- story detail
- comments
- replies

Trace actual Supabase errors.

Do not silently swallow errors.

============================================================
22. YEARS TOGETHER
============================================================

The interface previously showed:

est. 1990

but:

Years Together: 9

This is wrong.

Find where the value is generated.

Do NOT hard-code 9.

If the family was established in 1990, calculate the current number correctly based on the current date.

Use proper date logic.

Also search for other suspicious hard-coded statistics.

============================================================
23. STORAGE ARCHITECTURE AUDIT
============================================================

Search every upload/display implementation.

Audit:
- Profile
- Family Members
- Family Tree
- Gallery
- Add Memory
- Stories
- Milestones
- Family Activity
- Lightbox

There has historically been inconsistency between:
- public "memories" storage
- private "family-media" storage

Determine the canonical architecture from the repository.

For private family media:
- save storage paths/references
- generate signed URLs
- handle errors
- never expose service credentials

Do not leave broken URL-based workflows behind.

============================================================
24. SUPABASE TABLE AUDIT
============================================================

Search the entire frontend for every:

supabase.from(...)

reference.

Compare every referenced table against actual migrations.

Earlier broken references included names such as:

family_people
family_relationships
family_stories
story_people
story_comments
family_milestones
milestone_people
milestone_media
milestone_comments
milestone_contributions
milestone_steps

Do not assume these tables exist.

Compare them against the real migration/schema.

Fix frontend references to use the canonical schema.

If a missing table is genuinely required for a requested feature, create a proper migration with appropriate RLS.

Do not create unnecessary duplicate tables.

============================================================
25. AUTHENTICATION
============================================================

Audit login/signup after adding the password visibility control.

Verify:
- login
- signup
- password confirmation
- loading state
- errors
- Supabase auth
- session handling
- logout

Do not expose credentials.

The eye control is purely a UI visibility toggle.

============================================================
26. SIDEBAR
============================================================

Final sidebar must contain one clean navigation entry for each feature.

Check for duplicate:
- Family Activity
- Notifications
- any unexplained dot/icon
- repeated separators/items

Remove the unexplained dot below Family Members.

Do not hide it with CSS.

Find and remove the source of the duplicate.

============================================================
27. GENERAL UI CONSISTENCY
============================================================

The latest UI changes have not been applied consistently.

Audit the application globally.

Fix unfinished/basic-looking areas.

The visual language must be consistent across:
- Home
- Timeline
- Gallery
- Stories
- Family Tree
- Milestones
- Family Activity
- Family Members
- Profile
- Authentication

Use the same:
- typography
- spacing
- borders
- buttons
- input styles
- status styles
- responsive behavior

============================================================
28. RESPONSIVE QA
============================================================

Test narrow mobile width as well as desktop.

Pay special attention to:
- sidebar
- notification panel
- Family Tree
- Family Members
- Profile
- Story forms
- Milestone forms
- Gallery
- Lightbox

Fix:
- clipping
- horizontal overflow
- hidden controls
- off-screen dialogs
- text collisions

============================================================
29. NO MOCK DATA
============================================================

Search the entire repository for:
- Alexander
- Nina
- Michael
- Tamara
- Dmitry
- Anna
- mock
- demo
- placeholder
- fake

Determine whether any are being used as production Family Tree data.

Remove mock genealogy data from the Family Tree.

Do not delete legitimate real database records.

============================================================
30. ERROR HANDLING
============================================================

Every important mutation must show a useful result.

Examples:

"Uploading photo..."

"Photo uploaded successfully."

"Could not upload photo. Please try again."

"Story published."

"Could not publish story: [safe human-readable message]"

Do not show raw secrets.

Do not silently catch and ignore Supabase errors.

============================================================
31. FINAL BUILD AND SELF-AUDIT
============================================================

After implementing ALL changes:

Run:

npm run build

Run lint/type checks if configured.

Search the repository for:

- "Profile photo URL"
- hard-coded "9"
- duplicate "Family Activity"
- duplicate "Notifications"
- unexplained sidebar dot
- Alexander
- Nina
- Michael
- Tamara
- Dmitry
- Anna
- mock family data
- placeholder photos
- hard-coded image URLs
- public URLs for private family media
- service-role keys
- Supabase secret keys
- VAPID private keys
- cron secrets
- broken Supabase table names
- broken imports
- unused imports

Review git diff.

Fix build errors.

Remove temporary debugging code.

============================================================
32. FINAL USER-FLOW TEST
============================================================

Verify this complete flow:

LOGIN
→ password eye
→ successful login
→ Profile
→ upload own photo
→ write summary
→ save
→ refresh
→ Family Members
→ edit existing member
→ upload member photo
→ save
→ Family Tree
→ no mock people
→ clean empty structure
→ no brown root
→ no background artwork
→ no fake photo placeholders
→ add real family person
→ person appears in correct generation
→ Gallery
→ upload image
→ PNG works
→ old 2018 images display
→ Story
→ create
→ upload media
→ publish
→ Milestone
→ create
→ upload photo
→ save
→ Family Activity
→ real activity displays
→ PNG displays
→ Notifications
→ panel fully visible
→ sidebar contains no duplicate Family Activity
→ sidebar contains no unexplained dot
→ Home
→ Years Together is correct

============================================================
FINAL REPORT
============================================================

When finished, report:

1. Exact files changed
2. New/updated skill
3. Family Tree repairs
4. Profile repairs
5. Family Members repairs
6. Authentication/password repairs
7. Gallery repairs
8. Stories repairs
9. Milestone repairs
10. Family Activity repairs
11. Notification repairs
12. Storage changes
13. Supabase/database changes
14. Migrations created
15. RLS changes
16. Tests/build commands run
17. Remaining blockers

DO NOT GIVE ME ONLY A PLAN.

MAKE ALL SAFE CHANGES NOW.
TEST THEM.
THEN REPORT THE RESULT.