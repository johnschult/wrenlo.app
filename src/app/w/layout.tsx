// Widget routes are iframe-embeddable — no app chrome, no Tailwind, no ClerkProvider.
export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export const metadata = {
  title: 'wrenlo widget',
};
