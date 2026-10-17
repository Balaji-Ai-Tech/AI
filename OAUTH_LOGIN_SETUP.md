# OAuth setup (inactive)

The current TransformHub demo intentionally has no sign-in requirement. The login UI was removed, the authentication router is not mounted in the FastAPI app, and OAuth credentials are not required. This file is retained only as a reminder that OAuth is not part of the active application integration.

Do not configure or publish OAuth credentials for this demo. Reintroducing authentication requires an explicit product decision and wiring the backend router, session middleware, provider callbacks, and frontend flow together.
