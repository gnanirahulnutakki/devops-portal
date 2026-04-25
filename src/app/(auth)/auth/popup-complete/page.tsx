import PopupCompleteClient from './popup-complete-client';

export default async function PopupCompletePage({
  searchParams,
}: {
  // Next.js 15 types this as a Promise in PageProps
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await Promise.resolve(searchParams)) || {};
  const callbackUrl = typeof sp.callbackUrl === 'string' ? sp.callbackUrl : '/dashboard';
  const status = typeof sp.status === 'string' ? sp.status : 'success';

  return (
    <PopupCompleteClient
      callbackUrl={callbackUrl}
      status={status}
    />
  );
}

