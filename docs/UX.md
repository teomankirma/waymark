# Member-services UX acceptance

The member directory and account flow must be understandable before automation work begins. Basic usability is part of every feature PR.

The review used Vercel's [Web Interface Guidelines](https://vercel.com/design/guidelines), the installed Vercel shadcn/React skills, and an independent read-only Claude CLI critique. The concrete priorities were visible navigation, keyboard access, adequate touch targets, persistent URL state, clear recovery paths, and less duplicated content.

## Current behavior

- Open the directory and browse members without guessing a search term.
- Type `demo`, `demo001`, `001`, `DEMO 001`, `org`, or `avery morg`. Case and punctuation do not affect matching. Contains matching does not correct typos or reorder names.
- Open the explicit **View profile** action. Mobile keeps identity and that action visible; less important columns are hidden.
- Use the compact member header, **Overview** / **Savings** links, and directory breadcrumb. Search stays in `?q=` across navigation and refresh.
- Read a grouped balance and explicit currency in the titled account frame. The frame resizes to its content instead of introducing a large empty region or nested scrollbar.
- Clear search without losing focus. Invalid/no-result states offer a recovery action. Denied/expired states reveal no account data.
- Confirm before checking permission to close an account. Cancellation does nothing; the backend still always denies closure.

## Review checks

Test desktop and mobile Chromium, keyboard navigation, lowercase/partial search, back/refresh, no results, expiry/restore, restricted-action cancellation, and existing unavailable/offline scenarios. Inspect the rendered desktop/mobile layout as well as passing tests. Later discovery/replay work may add controls, but must preserve these behaviors.
