import type { BrowserContext, Page, Route } from 'playwright'
import type { ExecutorPolicy } from './policy.ts'
import { routeIndex } from './policy.ts'

/** Document-navigation guard. Not an XHR/WebSocket or host-network sandbox. */
export class NavigationBoundary {
  private violated = false

  constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
    private readonly policy: ExecutorPolicy,
  ) {}

  private deny() {
    this.violated = true
  }

  async install() {
    await this.context.route('**/*', async (route) => {
      try {
        await this.routeDocument(route)
      } catch {
        this.deny()
        await route.abort().catch(() => {})
      }
    })

    this.context.on('page', (page) => {
      if (page !== this.page) {
        this.deny()
        void page.close().catch(() => {})
      }
    })

    this.page.on('dialog', (dialog) => {
      this.deny()
      void dialog.dismiss().catch(() => {})
    })

    this.page.on('download', (download) => {
      this.deny()
      void download.cancel().catch(() => {})
    })

    this.page.on('framenavigated', (frame) => {
      if (
        frame.url() !== 'about:blank' &&
        routeIndex(this.policy, frame.url()) < 0
      ) {
        this.deny()
      }
    })
  }

  private async routeDocument(route: Route) {
    const request = route.request()

    if (!request.isNavigationRequest()) {
      await route.continue()

      return
    }

    if (
      request.frame().page() !== this.page ||
      request.method() !== 'GET' ||
      routeIndex(this.policy, request.url()) < 0
    ) {
      this.deny()
      await route.abort()

      return
    }

    // Routing does not reliably re-intercept every redirect hop. Fetch only the
    // approved URL without following redirects, then validate Location ourselves.
    const response = await route.fetch({ maxRedirects: 0, timeout: 10_000 })
    const location = response.headers().location

    if (
      response.status() >= 300 &&
      response.status() < 400 &&
      location &&
      routeIndex(this.policy, new URL(location, request.url()).href) < 0
    ) {
      this.deny()
      await route.abort()

      return
    }

    await route.fulfill({ response })
  }

  check(allowBlank = false) {
    if (this.violated) {
      return false
    }

    return this.page.frames().every((frame) => {
      if (frame.url() === 'about:blank') {
        return (
          (allowBlank && frame === this.page.mainFrame()) ||
          frame !== this.page.mainFrame()
        )
      }

      return routeIndex(this.policy, frame.url()) >= 0
    })
  }
}
