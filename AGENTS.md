<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules

- Never render fabricated data (counts, telemetry, notifications, histories) in the UI. Every visible number must come from a real data source, or the UI shows a loading/empty/error state that names what is unavailable. Why: the Nov 2026 recovery audit found dashboards and status bars displaying invented values as real.
- Settings that claim to save must persist (backend via `user_settings`/`profiles` server functions, or device-local via persisted Zustand stores) and reload after refresh. Local-only preferences must be labeled "stored on this device". Why: Settings previously showed success without persistence.
- Email confirmation is enabled; after signup without a session, show the "confirm your email" screen — never redirect to protected routes or claim success. Why: registration previously bounced users back to sign-in with a false success message.
- Pages whose backend capability does not exist (e.g. document indexing on Files) show a truthful unavailable state instead of mock tables or dead buttons.
