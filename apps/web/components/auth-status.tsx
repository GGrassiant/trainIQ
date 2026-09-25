export function AuthStatus({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-end gap-3 px-4 pt-4 text-sm">
      {signedIn ? (
        <>
          <span>Signed in</span>
          <form action="/auth/logout" method="post">
            <button className="underline underline-offset-4" type="submit">
              Sign out
            </button>
          </form>
        </>
      ) : (
        <a className="underline underline-offset-4" href="/auth/login/github">
          Sign in with GitHub
        </a>
      )}
    </div>
  );
}
