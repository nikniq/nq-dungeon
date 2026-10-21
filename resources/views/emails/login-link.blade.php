<!doctype html>
<html><body style="font-family:sans-serif;color:#1b1b2f;line-height:1.5">
  <p>Hello {{ $user->character?->name ?? $user->name }},</p>
  @if ($welcome)
    <p>Welcome to Dungeon Adventure. Click the link below to confirm this email address; it then lets you set a password for your hero.</p>
  @else
    <p>Here is your sign-in link for Dungeon Adventure. It logs you in and lets you set a new password.</p>
  @endif
  <p><a href="{{ $url }}" style="display:inline-block;padding:10px 16px;background:#1b7f4a;color:#fff;border-radius:6px;text-decoration:none">{{ $welcome ? 'Confirm my email' : 'Sign me in' }}</a></p>
  <p style="color:#666;font-size:.9em">The link works for two days and only from this email. If you did not ask for it, ignore this message.<br>{{ $url }}</p>
</body></html>
