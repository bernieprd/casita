### **Key GDPR Gaps**

#### **1. No right to erasure (Article 17) — the biggest gap**

`leaveHousehold` removes the membership row, but the user’s data stays everywhere:

- Google tokens in KV (`google_tokens:`, `user_calendars:`)
- Recipe photos in R2 they uploaded
- Todos, recipes, items they created (no `created_by` column, so you can’t even identify which are theirs)
- Clerk account persists

**Fix**: Add a `DELETE /account` endpoint that cascades through KV, R2, and D1. You’d also want to add a `created_by` column to items/recipes/todos so you can attribute data to individual users, not just households.

**What to Tell Users**

In your privacy policy and in the delete-account confirmation UI, be explicit:

*“Deleting your account removes your personal information (email, profile, calendar connection). Recipes, shopping list items, and todos you contributed to the household will remain for other members but will no longer be linked to you.”*

This is the transparency piece GDPR requires. As long as users know this *before* they contribute data to the household, you’re on solid ground. No surprises, no complaints.

**The Owner Problem**

The one tricky case: what happens when the household *owner* deletes their account? Your current code already blocks owners from leaving (`Owners cannot leave the household`). You’d want the same guard on account deletion, with a flow like:

1. Transfer ownership to another member first, then delete
2. Or, if they’re the last member, delete the entire household and all its data (a full wipe)

That keeps the experience intact for remaining members and avoids orphaned households.

#### **2. No data export / portability (Articles 15 & 20)**

There’s no way for a user to download their data.

**Fix**: Add a `GET /account/export` endpoint that aggregates their household data, calendar settings, and profile info into a JSON download.

#### **3. No privacy policy or consent mechanism**

The app collects personal data and connects to Google Calendar without any GDPR-compliant consent flow. Clerk handles authentication consent, but your *app-level* data processing isn’t documented anywhere.

**Fix**: Create a privacy policy page covering what you collect, why, how long you keep it, and who processes it (Clerk, Cloudflare, Google). Show it at first login and get explicit consent before connecting Google Calendar.

#### **4. Google tokens stored without TTL**

In `google-auth.ts`, tokens are written to KV with no `expirationTtl`:

```tsx
await env.AUTH_KV.put(`google_tokens:${clerkUserId}`, JSON.stringify({...}))
```

OAuth state gets a 600s TTL (good), but the actual tokens live forever even if the user never returns.

**Fix**: Set a reasonable `expirationTtl` on token storage and rotate/clean up on disconnect.

#### **5. Member email exposure without consent**

`getHousehold` in `household.ts` fetches all members’ emails from Clerk and returns them to every household member. One member joining exposes their email to all existing members without any opt-in.

**Fix**: Either don’t return emails by default (use display name only), or add a consent step when joining a household that explains what info will be shared.

#### **6. Request logging may capture PII**

```tsx
console.log(`[ROUTE HIT] ${req.method} ${req.url}`)
```

If any route passes user data in query params, this logs PII. Cloudflare Workers logs are retained by Cloudflare.

**Fix**: Sanitize URLs before logging, or log only the route pattern (not the full URL).

### **Quick-Win Checklist**

| Priority | Action |
| --- | --- |
| High | Add `DELETE /account` endpoint (erasure) |
| High | Write a privacy policy page |
| High | Add `expirationTtl` to Google token KV storage |
| Medium | Add `GET /account/export` endpoint (portability) |
| Medium | Add `created_by` column to D1 tables |
| Medium | Stop exposing member emails without consent |
| Medium | Add consent UI before Google Calendar connection |
| Low | Sanitize request logging |
| Low | Document your third-party data processors |

The high-priority items are what would expose you most in a complaint. The schema change (`created_by`) is the most impactful structural improvement because without it, you fundamentally can’t tell who owns what data inside a household.