import { ChatWidget } from '../../[businessId]/chat-widget';

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ name?: string; theme?: string }>;
}) {
  const { sessionId } = await params;
  const { name, theme } = await searchParams;

  return (
    <ChatWidget
      sessionId={sessionId}
      businessName={name ?? 'Preview'}
      mode="preview"
      initialTheme={theme === 'light' ? 'light' : 'dark'}
    />
  );
}
