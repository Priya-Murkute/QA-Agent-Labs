# StudySphere — Online Course Marketplace
### Product Requirements Document · v0.3 · Draft

## 1. Overview

StudySphere is a two-sided marketplace where independent instructors publish
video courses and learners browse, purchase, and complete them. This document
covers the functional requirements for the web application only; mobile apps
are a later phase and out of scope here.

## 2. Authentication and accounts

Learners and instructors share a single sign-up flow but get different
dashboards after login based on their account type, chosen at registration.
A user can hold both roles simultaneously (an instructor can also purchase
courses as a learner).

Sign-up requires an email address, a password meeting minimum complexity
(8+ characters, at least one number), and acceptance of the terms of service.
On successful sign-up, a verification email is sent with a link valid for
24 hours; unverified accounts can browse the catalog but cannot purchase or
publish anything. Login supports email+password as well as "Sign in with
Google." Forgotten passwords are recovered via a time-limited reset link sent
to the registered email, and using an expired or already-used link must show
a clear error rather than silently failing.

Sessions persist for 30 days via a refresh token stored in an httpOnly
cookie. Logging out on one device should not automatically log out other
devices. Users can view and revoke individual active sessions from account
settings, and can permanently delete their account, which anonymizes their
reviews but does not delete purchase records needed for tax/legal reasons.

## 3. Course catalog and search

The catalog is the main discovery surface. Learners can browse by category
(a fixed taxonomy, e.g. "Web Development," "Data Science," "Design"), filter
by price range, rating, duration, and language, and sort by relevance,
newest, or most popular. Free-text search matches course titles,
descriptions, and instructor names, with typo tolerance for common
misspellings.

Each course listing shows a preview video (first lesson, always free to
watch even for non-purchasers), a syllabus outline with section and lesson
titles (but not lesson content, which is locked), the instructor's bio and
average rating across all their courses, and the course's own rating
breakdown (1-5 stars with counts per star). Courses that are unpublished by
their instructor, or that fail a moderation review, must not appear in
search results or category browsing, even via a direct old link — those
should show a "no longer available" page instead of a 404 or a broken
player.

## 4. Enrollment and payment

Learners purchase individual courses (no subscription model in this phase).
Checkout collects a payment method (mocked in this phase — no real payment
processor integration yet, per the phase-1 UI-first approach) and applies
any valid discount code entered. An invalid or expired discount code should
show an inline error without clearing the rest of the checkout form.
Successful purchase immediately grants access to all course content and
sends a receipt email with the course title, price paid, and a link to start
learning.

StudySphere offers a 14-day money-back guarantee: a learner who has
completed less than 30% of a course's lessons can request a refund from
their purchase history, which immediately revokes access and reverses the
transaction. Attempting to refund a course after the 14-day window, or after
completing 30% or more, must show the specific reason it's not eligible
rather than a generic "not allowed" message, since instructors and support
staff need to be able to explain refund decisions to learners.

## 5. Video playback and progress tracking

Course content is organized into sections, each containing one or more
lessons (video, and optionally a downloadable resource file and a short
text article). The player must support variable playback speed (0.5x to
2x), captions when the instructor has uploaded them, and resuming from the
exact timestamp a learner left off, per device.

A lesson is marked complete automatically once 90% of its duration has been
watched, or manually if the learner clicks "mark as complete" early. Course
progress is shown as a percentage on the learner's dashboard and updates in
real time as lessons are completed. Finishing 100% of a course's lessons
issues a certificate of completion (a generated PDF with the learner's name,
course title, instructor name, and completion date) that can be downloaded
or shared via a public verification link.

## 6. Instructor dashboard and course authoring

Instructors create courses through a multi-step authoring flow: basic info
(title, description, category, price), curriculum (sections and lessons,
reorderable via drag-and-drop), then content upload per lesson. Video
uploads are transcoded asynchronously; the instructor sees an upload
progress bar followed by a "processing" status until transcoding completes,
and must not be able to publish a course with any lesson still stuck in
"processing" or "failed" status.

Courses start as drafts, fully editable and invisible to learners. Submitting
a draft for publication triggers a moderation review (see §8) before it goes
live. After a course is live, instructors can still edit it, but substantial
changes (adding/removing whole sections, changing the price by more than
20%) trigger a re-review, while minor edits (typo fixes, re-recording a
single lesson) do not.

The instructor dashboard shows enrollment counts, revenue (StudySphere takes
a 30% platform fee, so the instructor's shown figure must be their net
share, not the gross sale price), and a breakdown of ratings and written
reviews, with the ability to publicly reply to a review once.

## 7. Reviews and ratings

Only learners who have purchased a course can leave a review, and only after
watching at least one lesson. A review consists of a 1-5 star rating and
optional text. Learners can edit their own review at any time, which updates
the course's aggregate rating immediately. A learner can leave at most one
review per course; attempting to submit a second review should update the
existing one rather than creating a duplicate.

Reviews containing flagged content (profanity, personal contact information,
or content matching known spam patterns) are held for moderator approval
before appearing publicly, and the learner who submitted it sees a "pending
review" state rather than assuming it was silently rejected or lost.

## 8. Admin and moderation

Platform admins review newly submitted courses before they go live, checking
against a content policy checklist (accurate title/description, appropriate
content, working preview video). A course can be approved, rejected with a
required reason shown to the instructor, or sent back with specific
requested changes. Rejected courses remain editable by the instructor and
can be resubmitted.

Admins can also suspend a course post-publication (e.g. following user
reports), immediately removing it from the catalog and search while
preserving already-enrolled learners' access, and can suspend an instructor
account entirely, which unpublishes all of that instructor's courses at
once. Suspended instructors should see a clear explanation when they try to
log in or access their dashboard, not a generic error.

## 9. Notifications

Learners receive email notifications for: purchase confirmation, certificate
issued, and instructor replies to their reviews. Instructors receive
notifications for: new enrollment, new review, course approved/rejected, and
payout processed. All notification types can be individually toggled off in
account settings except purchase confirmation and payout processed, which
are mandatory for record-keeping and cannot be disabled.

## 10. Non-functional requirements

The catalog page must load with a meaningful first paint within 2 seconds on
a typical broadband connection. Search results should return within 500ms
for catalogs up to 50,000 courses. All payment-adjacent flows (checkout,
refunds) must be logged in an audit trail that admins can review, separate
from the general application logs, and this audit trail is append-only —
nothing in it can be edited or deleted, even by admins.

## 11. Personas

**Learner — "Devon"**: mid-career professional, buys 3-4 courses a year to
learn specific skills for work, usually on mobile during commute but
prefers desktop for hands-on coding courses. Wants to know before buying
whether a course actually covers what they need, hence the free preview
lesson and detailed syllabus. Gets frustrated by courses that look
abandoned (no recent reviews, outdated screenshots).

**Instructor — "Priya"**: teaches part-time alongside a full-time job,
publishes 2-3 courses total, cares a lot about seeing accurate revenue
numbers and understanding exactly why a course was rejected in moderation
so she doesn't waste a resubmission cycle guessing. Checks the dashboard
weekly, not daily.

**Admin — "Marcus"**: reviews roughly 20 new course submissions a week
plus handles user reports. Needs the moderation queue sorted by wait time
so nothing sits forgotten, and needs suspension actions to be reversible
in case of a mistaken report.

## 12. Technical context (for background only, not requirements)

The web application will be built as a server-rendered React application
with a PostgreSQL database and object storage for video files. Video
transcoding runs asynchronously via a queue worker. Search is backed by a
dedicated search index rather than direct database queries, to meet the
500ms latency target at catalog scale. None of this section describes
user-facing behavior and should not itself generate test scenarios — it
exists purely to give engineering context for the requirements above.

## 13. Risks and open questions

- What happens to an in-progress course purchase if the instructor
  suspends or deletes the course mid-transaction? Currently undefined;
  flagged for product decision before Phase 2.
- Refund abuse (a learner buying, completing under 30%, refunding, and
  repeating across many courses) is not addressed by any requirement above
  and needs a policy decision — out of scope for this version.
- Certificate verification links are public and permanent; there is no
  requirement yet for an instructor or admin to revoke a previously issued
  certificate if fraud is discovered after the fact.

## 14. Glossary (background only)

**Transcoding** — converting an uploaded video into multiple resolutions
for adaptive streaming. **Moderation queue** — the ordered list of courses
awaiting admin review. **Net share** — the portion of a sale price paid to
the instructor after the platform fee. **Audit trail** — the append-only
log of payment-adjacent actions described in §10.
