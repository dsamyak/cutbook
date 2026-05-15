import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "CutBook — Salon Manager" },
        {
          name: "description",
          content:
            "Complete salon and barbershop management — billing, clients, staff, expenses, and more.",
        },
        // PWA / Mobile
        { name: "theme-color", content: "#4b1fa3" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        { name: "apple-mobile-web-app-title", content: "CutBook" },
        // Security — prevent caching of sensitive pages
        { "http-equiv": "Cache-Control", content: "no-store, no-cache, must-revalidate" },
        { "http-equiv": "Pragma", content: "no-cache" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.json" },
        { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
        { rel: "apple-touch-icon", href: "/icon-192.png" },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
