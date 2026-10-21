Hello {{ $user->character?->name ?? $user->name }},

@if ($welcome)
Welcome to Dungeon Adventure. Open the link below to confirm this email address; it then lets you set a password for your hero.
@else
Here is your sign-in link for Dungeon Adventure. It logs you in and lets you set a new password.
@endif

{{ $url }}

The link works for two days and only from this email. If you did not ask for it, ignore this message.
