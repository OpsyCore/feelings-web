# Google Play — Data safety form: exact answers

Fill the Play Console «Data safety» form with these answers. They match what the app
actually does (Supabase backend, HTTPS only, no third-party SDKs in the bundle).

## Is data collected or shared?

- Data collected: **Yes**. Data shared with third parties: **No**.

## Data types

| Data type | Collected? | Shared? | Required? | Notes |
| --- | --- | --- | --- | --- |
| Email address | Yes | No | Yes (app won't work without) | Account sign-up/login |
| Name | Yes | No | No | Display name, optional |
| User IDs | Yes | No | Yes | Internal Supabase auth IDs |
| Photos | Yes | No | No | Moment/memory images, user-uploaded |
| Other in-app content | Yes | No | No | Feelings, diary entries, dates, care gestures, cycle logs |
| Approximate location | **No** | No | — | Not collected |
| Precise location | **No** | No | — | Not collected |
| Health info | **No** | No | — | Cycle logs are personal journal entries, not health data processing; if you prefer caution you may declare them as "Other in-app content" (recommended) |
| Financial info | **No** | No | — | No payments |
| Contacts | **No** | No | — | Not accessed |
| Device or other IDs | **No** | No | — | No advertising/tracking IDs |

## Security & handling — answer per collected type

- Data encrypted in transit: **Yes** (HTTPS/TLS everywhere)
- Can't be deleted: **No** — users can request deletion; account deletion in Settings removes personal data
- Data processed outside the required jurisdiction: review Supabase region settings (project region is set in the Supabase dashboard) and answer accordingly

## Other form facts

- Target audience: **18+** (do not target children; no child-directed content)
- App category: **Lifestyle** (secondary: Dating — optional)
- Contains ads: **No**
- In-app purchases: **No**
