# Case Study: Account Management Module

Our product team ran a discovery session with users of the "Acme Cloud" web app
and captured the following notes on what the account area needs to support.
This is informal — treat it as raw input, not a spec.

## Background

Acme Cloud currently has no self-service account area. Users email support to
reset a password or update their email, which takes 1-2 business days. Support
tickets related to this account back and forth make up 30% of all tickets.

## What users told us

"I just want to sign up without waiting for someone to approve me." — several
users mentioned wanting instant access after signing up with an email and
password, with a confirmation email sent afterward. Weak passwords should be
rejected at signup with a clear message about what's required (currently
nothing stops someone using "1234").

Multiple users complained about being locked out and having no way to get
back in themselves. They want to be able to request a password reset link by
email, click it, and set a new password, with the old one no longer working
afterward. Reset links should expire — users shouldn't be able to reuse an old
email months later to break into an account.

One enterprise customer asked specifically for two-factor authentication:
after entering the correct password, the user should be prompted for a
6-digit code sent to their phone, and login should only complete once that
code is verified. Wrong codes, expired codes, and too many wrong attempts all
need to be handled without letting an attacker in.

Finally, several users wanted to be able to change the email address on their
account from a settings page, and have that require re-confirming the new
address before it takes effect (to avoid someone locking out the real account
owner by mistyping an email).

## Out of scope for this round

Billing, team invites, and SSO are being handled in a separate initiative and
should not be considered part of this requirement set.
