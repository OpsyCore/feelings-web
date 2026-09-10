# FEELINGS design system

## Identity
FEELINGS · دو نفر، یک احساس · Two people, one feeling.
A private, emotionally warm home for two, not an analytics dashboard or social feed. Primary presentation is Persian RTL. English changes document direction, content strings, navigation, date formatting and fonts. Stored user-authored text is not machine-translated.

## Foundations
Central tokens are in `src/index.css`, with a separate `[data-theme=dark]` palette. Light: warm ivory background #faf8f5, cards #fffefc, soft cream #faf7f3, ink #39332f, coral #e97d71, pale coral #fceee8, peach #f7e4d8, lavender #ece7f2, borders #eee8e2. Dark: warm plum/charcoal #201d20, cards #2a2529, soft surface #30292d, text #f2e8e1, coral #ef9a8f, borders #3e3339. Hero, illustrations, photographs and muted accents receive specific dark treatments instead of color inversion.

Typography: Vazirmatn 400–800 for Persian, DM Sans for English and Latin brand. Default body 14px; page heading 25px, section headings 14–20px, labels 11–13px. The compact desktop home intentionally uses small secondary captions. Automated contrast and device readability checks are still required, particularly secondary captions and pastel CTA colors; do not claim WCAG certification.

Geometry: 21px main card radius (19px mobile), 10–12px button/input/chip radii, 23px dialogs. Main desktop gutters 39px, card padding ~20–26px, section gaps 22–23px. Tiny warm shadows distinguish cards without corporate elevation. Icon system is lucide-react with 1.5–2px strokes; platform emoji identify feelings/care. No decorative imagery is presented as actual personal content.

## Layout
Desktop: RTL right sidebar / LTR left sidebar, about 234px; contained main column. Identity/navigation are calm and compact. Primary home composition:
1. Greeting and locale date; small notification, theme, language/profile controls.
2. Editorial warm coffee hero with a connection invitation.
3. My feeling and partner/no-partner cards.
4. Quick care gestures and an actual received-care row when data exists.
5. Recent memories and upcoming dates.
6. A human daily suggestion and today's summary.

Mobile: five fixed bottom tabs (Home, Feelings, Moments, Care, Profile), comfortable cards, secondary navigation in a drawer, single-column mood/partner cards at narrow widths. Explicit breakpoints cover 360/375/390/412/430, tablet, desktop and large desktop. Formal browser viewport tests are supplied but unexecuted.

## Reusable components
`src/components/ui.tsx`: Button, IconButton, Card, SectionHeading, Arrow, EmptyState, Modal, ConfigNotice, ConfigDetails, PrivacyNote, Skeleton, Tabs, Toggle, RemoteImage, Avatar.
`home.tsx`: MoodComposer, PartnerCard, ReactionPicker, CareButtons.
`forms.tsx`: AuthDialog, Onboarding, InviteDialog, QRScanner, EntryEditor, ConfigurationDialog.
`screens.tsx`: EntryList, EntryDetail and specialized domain screens.
`settings.tsx`: ProfilePage, ProfileEditor, SettingsPage and Preferences.

## States and behavior
- Draft selections never create saved data until the remote operation resolves successfully.
- No partner: abstract two-circle connection illustration, create/join actions, no invented name/avatar/status.
- Empty collections: domain icon, friendly short explanation, useful create action.
- Config-safe state: visible footer status, details modal, inline notices in forms; saving is rejected rather than simulated.
- Errors: localized toast or inline validation; form stays open after failure.
- Loading: button spinner/disabled repeat action; skeletons for collection fetches.
- Offline: quiet persistent banner; no failed mutation retry that could duplicate a write; safe read refresh on reconnect.
- Destruction: contextual confirmation, with typed account-deletion confirmation; draft-close confirmation for record/profile editors.
- Reactions/care: subtle actual-data update animations; no fake online state or confetti.

## Motion and accessibility
Short 150–300ms fades/pops, reduced-motion override, focus-visible outlines, labeled forms, semantic buttons/sections, aria-pressed moods, tab states, screen-reader labels, role alert/status for notices. Modal traps tab focus, restores focus and handles Escape/backdrop, with unsaved draft confirmation. Fixed bottom navigation includes safe-area padding.

Further QA: actual keyboard and screen-reader runs, WCAG contrast audit, 44px target review on compact secondary controls, and RTL/device screenshots. These were not browser-tested in this session.
