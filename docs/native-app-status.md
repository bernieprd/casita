# Native App (Android & iOS) — Status & What's Next

## What's working

- **Android**: builds, runs, and authenticates. `https://localhost` (Capacitor's Android scheme) is allowed in the worker's CORS policy.
- **iOS build**: compiles and deploys to simulator. The invalid-URL-scheme error from Clerk on `capacitor://localhost` is fixed — `ClerkProvider` omits `signInUrl`/`signUpUrl` on iOS native, and `<SignIn>`/`<SignUp>` use `routing="hash"` instead of `routing="path"`.
- **Worker CORS**: `NATIVE_ORIGINS = ['https://localhost', 'capacitor://localhost']` is deployed to production.

## What's NOT done yet / known issues

### 1. iOS sign-in not tested end-to-end
The invalid URL scheme error was fixed in code but the iOS simulator session wasn't verified after the fix. Need to confirm:
- Sign in with Google on iOS works
- Sign in with email/password on iOS works (was "getting stuck" — possibly related to the Clerk hash routing change or a separate issue)
- After sign-in, household loads correctly (CORS for `capacitor://localhost` is deployed)

### 2. clerk.ts iss-based JWKS reverted — native auth may need re-validation
The branch originally added an iss-based JWKS approach (`use iss claim from JWT to fetch JWKS`) to handle multi-instance Clerk setups. This was deployed and broke production (Google OAuth users got 401s because their JWT `iss` may be a custom Clerk domain not in the trusted list). It was reverted to main's secretKey-based approach (`api.clerk.com/v1/jwks` with `CLERK_SECRET_KEY`).

The Android app appeared to work after this revert was already in progress (the CORS fix alone may have been sufficient). But native auth should be verified again once sign-in is tested on iOS.

If native auth breaks again: the root cause was that the worker's `CLERK_SECRET_KEY` belongs to a different Clerk instance than the one used by the native app during dev/test. The safe fix is to ensure the native app uses the same Clerk publishable key as the worker's secret key, or to use a staging environment for testing the iss-based approach.

### 3. iOS safe area / status bar
The header has `paddingTop: env(safe-area-inset-top)` which should handle the Dynamic Island. Verify visually on the simulator — check that content isn't hidden under the notch.

### 4. Android back button
Tested in code (`CapApp.addListener('backButton', ...)`) but not verified manually. Check: back button navigates within the app, and pressing it at the root tab exits the app.

### 5. Not on App Store / Play Store
The native app is not submitted to either store. Before doing so:
- Switch from `pk_test_` Clerk key to `pk_live_` in the production build environment
- Add app signing configuration for both Android (keystore) and iOS (provisioning profile)
- Set a proper `applicationId` / bundle ID if needed

## How to re-run locally

```bash
# Build web assets
pnpm -C frontend build

# Android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_SDK_ROOT=~/Library/Android/sdk \
npx -C frontend cap run android --target emulator-5554

# iOS (iPhone 17 Pro simulator UDID)
npx -C frontend cap run ios --target 3B3B242C-AE8D-4342-BE10-7F854F48965E
```

## Files changed on this branch (vs main)

| File | What changed |
|------|-------------|
| `frontend/capacitor.config.ts` | Capacitor config (appId, splashscreen, status bar) |
| `frontend/src/App.tsx` | Capacitor init `useEffect` (status bar, splash, back button); iOS-safe Clerk routing |
| `frontend/src/components/LocalizedClerkProvider.tsx` | Omit `signInUrl`/`signUpUrl` on iOS native |
| `worker/src/index.ts` | `NATIVE_ORIGINS` added to CORS allowlist |
| `frontend/android/` | Full Android project (Capacitor-generated) |
| `frontend/ios/` | Full iOS project (Capacitor-generated) |
